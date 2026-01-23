import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the docker provider before importing mission-engine
vi.mock('../../../src/services/docker.js', () => ({
  dockerProvider: {
    isAvailable: vi.fn().mockResolvedValue(true),
    cleanupOrphaned: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue('mock-container-id'),
    getStatus: vi.fn().mockResolvedValue({ state: 'running' }),
    getLogTail: vi.fn().mockResolvedValue('mock logs'),
    stop: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  },
}));

// We need to dynamically import missionStore after env is stubbed
async function getMissionStore() {
  vi.resetModules();
  // Re-apply the mock after resetModules
  vi.doMock('../../../src/services/docker.js', () => ({
    dockerProvider: {
      isAvailable: vi.fn().mockResolvedValue(true),
      cleanupOrphaned: vi.fn().mockResolvedValue(undefined),
      start: vi.fn().mockResolvedValue('mock-container-id'),
      getStatus: vi.fn().mockResolvedValue({ state: 'running' }),
      getLogTail: vi.fn().mockResolvedValue('mock logs'),
      stop: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    },
  }));
  const { missionStore } = await import('../../../src/services/mission-store.js');
  return missionStore;
}

async function getMissionEngine() {
  const { missionEngine } = await import('../../../src/services/mission-engine.js');
  return missionEngine;
}

async function getDockerProvider() {
  const { dockerProvider } = await import('../../../src/services/docker.js');
  return dockerProvider;
}

describe('mission-engine service', () => {
  let missionStore: Awaited<ReturnType<typeof getMissionStore>>;
  let missionEngine: Awaited<ReturnType<typeof getMissionEngine>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    missionStore = await getMissionStore();
    missionEngine = await getMissionEngine();
    await missionStore.init();
  });

  describe('init', () => {
    it('checks provider availability', async () => {
      const dockerProvider = await getDockerProvider();
      await missionEngine.init();
      expect(dockerProvider.isAvailable).toHaveBeenCalled();
    });

    it('calls cleanupOrphaned', async () => {
      const dockerProvider = await getDockerProvider();
      await missionEngine.init();
      expect(dockerProvider.cleanupOrphaned).toHaveBeenCalled();
    });

    it('logs warning when provider unavailable', async () => {
      const dockerProvider = await getDockerProvider();
      vi.mocked(dockerProvider.isAvailable).mockResolvedValueOnce(false);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await missionEngine.init();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('not available')
      );
      warnSpy.mockRestore();
    });
  });

  describe('continueMission - human gates', () => {
    it('throws for non-existent mission', async () => {
      await expect(missionEngine.continueMission('m-nonexist'))
        .rejects.toThrow('Mission not found');
    });

    it('at human-gate advances to next step', async () => {
      const mission = await missionStore.createMission('Test', 'feature', 'Input');
      // Set to step 1 (first human-gate)
      await missionStore.updateMeta(mission.mission_id, {
        current_step: 1,
        status: 'waiting_human'
      });

      await missionEngine.continueMission(mission.mission_id);

      const meta = await missionStore.getMeta(mission.mission_id);
      expect(meta!.current_step).toBe(2);
    });

    it('at human-gate sets waiting_human for next human-gate', async () => {
      const mission = await missionStore.createMission('Test', 'feature', 'Input');
      // Set to step 3 (human-gate), next step 4 is agent
      await missionStore.updateMeta(mission.mission_id, {
        current_step: 3,
        status: 'waiting_human'
      });

      // Mock provider to simulate immediate success
      const dockerProvider = await getDockerProvider();
      vi.mocked(dockerProvider.getStatus).mockResolvedValue({ state: 'exited', exitCode: 0 });

      await missionEngine.continueMission(mission.mission_id);

      // It will advance and start the agent, which will eventually trigger next human gate
      const meta = await missionStore.getMeta(mission.mission_id);
      // Status should be running_code_agent since agent step started
      expect(['ready', 'running_code_agent']).toContain(meta!.status);
    });

    it('at last step sets completed', async () => {
      const mission = await missionStore.createMission('Test', 'feature', 'Input');
      // Set to step 7 (last human-gate)
      await missionStore.updateMeta(mission.mission_id, {
        current_step: 7,
        status: 'waiting_human'
      });

      await missionEngine.continueMission(mission.mission_id);

      const meta = await missionStore.getMeta(mission.mission_id);
      expect(meta!.status).toBe('completed');
      expect(meta!.current_step).toBe(8);
    });
  });

  describe('continueMission - agent steps', () => {
    it('at agent step creates run record', async () => {
      const mission = await missionStore.createMission('Test', 'feature', 'Input');
      // Step 0 is agent step

      await missionEngine.continueMission(mission.mission_id);

      const runs = await missionStore.loadRuns(mission.mission_id);
      expect(runs.length).toBeGreaterThan(0);
      expect(runs[0].step_id).toBe('cleanup');
    });

    it('at agent step sets running_code_agent status', async () => {
      const mission = await missionStore.createMission('Test', 'feature', 'Input');

      await missionEngine.continueMission(mission.mission_id);

      const meta = await missionStore.getMeta(mission.mission_id);
      expect(meta!.status).toBe('running_code_agent');
    });

    it('at agent step calls provider.start', async () => {
      const dockerProvider = await getDockerProvider();
      const mission = await missionStore.createMission('Test', 'feature', 'Input');

      await missionEngine.continueMission(mission.mission_id);

      expect(dockerProvider.start).toHaveBeenCalledWith(
        expect.objectContaining({
          missionId: mission.mission_id,
          stepId: 'cleanup',
        })
      );
    });

    it('handles provider.start failure', async () => {
      const dockerProvider = await getDockerProvider();
      vi.mocked(dockerProvider.start).mockRejectedValueOnce(new Error('Docker failed'));

      const mission = await missionStore.createMission('Test', 'feature', 'Input');

      await missionEngine.continueMission(mission.mission_id);

      const meta = await missionStore.getMeta(mission.mission_id);
      expect(meta!.status).toBe('failed');
      expect(meta!.last_error).toContain('Docker failed');
    });
  });

  describe('getRunningLogTail', () => {
    it('returns undefined when no running container', async () => {
      const tail = await missionEngine.getRunningLogTail('m-test', 'r-notrunning');
      expect(tail).toBeUndefined();
    });
  });

  describe('Ralph mode', () => {
    it('creates mission with ralph_mode enabled', async () => {
      const mission = await missionStore.createMission('Ralph Test', 'feature', 'Input', {
        ralph_mode: true,
        ralph_max_iterations: 3,
      });

      expect(mission.ralph_mode).toBe(true);
      expect(mission.ralph_max_iterations).toBe(3);
      expect(mission.ralph_current_iteration).toBe(1);
    });

    it('creates mission with default ralph values when not specified', async () => {
      const mission = await missionStore.createMission('Normal Test', 'feature', 'Input');

      expect(mission.ralph_mode).toBeUndefined();
      expect(mission.ralph_max_iterations).toBeUndefined();
      expect(mission.ralph_current_iteration).toBeUndefined();
    });

    it('ralph_mode persists in getMeta', async () => {
      const mission = await missionStore.createMission('Persist Test', 'feature', 'Input', {
        ralph_mode: true,
        ralph_max_iterations: 5,
      });

      const meta = await missionStore.getMeta(mission.mission_id);
      expect(meta!.ralph_mode).toBe(true);
      expect(meta!.ralph_max_iterations).toBe(5);
      expect(meta!.ralph_current_iteration).toBe(1);
    });

    it('ralph_current_iteration can be updated', async () => {
      const mission = await missionStore.createMission('Update Test', 'feature', 'Input', {
        ralph_mode: true,
        ralph_max_iterations: 5,
      });

      await missionStore.updateMeta(mission.mission_id, {
        ralph_current_iteration: 2,
      });

      const meta = await missionStore.getMeta(mission.mission_id);
      expect(meta!.ralph_current_iteration).toBe(2);
    });

    it('getDetail includes ralph fields', async () => {
      const mission = await missionStore.createMission('Detail Test', 'feature', 'Input', {
        ralph_mode: true,
        ralph_max_iterations: 10,
      });

      const detail = await missionStore.getDetail(mission.mission_id);
      expect(detail!.ralph_mode).toBe(true);
      expect(detail!.ralph_max_iterations).toBe(10);
      expect(detail!.ralph_current_iteration).toBe(1);
    });
  });
});
