import { describe, it, expect, beforeEach, vi } from 'vitest';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { getTestDir } from '../../setup.js';

// We need to dynamically import missionStore after env is stubbed
// because config.ts reads HAFLOW_HOME at module load time
async function getMissionStore() {
  vi.resetModules();
  const { missionStore } = await import('../../../src/services/mission-store.js');
  return missionStore;
}

describe('mission-store service', () => {
  describe('init', () => {
    it('creates missions directory if not exists', async () => {
      const testDir = getTestDir();
      const missionStore = await getMissionStore();
      await missionStore.init();
      expect(existsSync(join(testDir, 'missions'))).toBe(true);
    });

    it('is idempotent - safe to call multiple times', async () => {
      const missionStore = await getMissionStore();
      await missionStore.init();
      await missionStore.init();
      await missionStore.init();
      const testDir = getTestDir();
      expect(existsSync(join(testDir, 'missions'))).toBe(true);
    });
  });

  describe('createMission', () => {
    let missionStore: Awaited<ReturnType<typeof getMissionStore>>;

    beforeEach(async () => {
      missionStore = await getMissionStore();
      await missionStore.init();
    });

    it('returns MissionMeta with generated ID', async () => {
      const meta = await missionStore.createMission('Test Mission', 'feature', 'Raw input');
      expect(meta.mission_id).toMatch(/^m-[a-f0-9]{8}$/);
    });

    it('returns MissionMeta with timestamps', async () => {
      const before = new Date().toISOString();
      const meta = await missionStore.createMission('Test Mission', 'feature', 'Raw input');
      const after = new Date().toISOString();

      expect(meta.created_at >= before).toBe(true);
      expect(meta.created_at <= after).toBe(true);
      expect(meta.updated_at).toBe(meta.created_at);
    });

    it('creates directory structure', async () => {
      const meta = await missionStore.createMission('Test Mission', 'feature', 'Raw input');
      const testDir = getTestDir();
      const missionDir = join(testDir, 'missions', meta.mission_id);

      expect(existsSync(missionDir)).toBe(true);
      expect(existsSync(join(missionDir, 'artifacts'))).toBe(true);
      expect(existsSync(join(missionDir, 'runs'))).toBe(true);
      expect(existsSync(join(missionDir, 'logs'))).toBe(true);
    });

    it('writes mission.json', async () => {
      const meta = await missionStore.createMission('Test Mission', 'feature', 'Raw input');
      const testDir = getTestDir();
      const metaPath = join(testDir, 'missions', meta.mission_id, 'mission.json');

      const content = await readFile(metaPath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.mission_id).toBe(meta.mission_id);
      expect(parsed.title).toBe('Test Mission');
    });

    it('writes raw-input.md artifact', async () => {
      const meta = await missionStore.createMission('Test Mission', 'feature', 'My raw input');
      const testDir = getTestDir();
      const artifactPath = join(testDir, 'missions', meta.mission_id, 'artifacts', 'raw-input.md');

      const content = await readFile(artifactPath, 'utf-8');
      expect(content).toBe('My raw input');
    });

    it('sets initial status to ready', async () => {
      const meta = await missionStore.createMission('Test Mission', 'feature', 'Raw input');
      expect(meta.status).toBe('ready');
    });

    it('sets current_step to 0', async () => {
      const meta = await missionStore.createMission('Test Mission', 'feature', 'Raw input');
      expect(meta.current_step).toBe(0);
    });
  });

  describe('getMeta', () => {
    let missionStore: Awaited<ReturnType<typeof getMissionStore>>;

    beforeEach(async () => {
      missionStore = await getMissionStore();
      await missionStore.init();
    });

    it('returns null for non-existent mission', async () => {
      const meta = await missionStore.getMeta('m-nonexist');
      expect(meta).toBeNull();
    });

    it('returns parsed MissionMeta for existing mission', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      const meta = await missionStore.getMeta(created.mission_id);

      expect(meta).not.toBeNull();
      expect(meta!.mission_id).toBe(created.mission_id);
      expect(meta!.title).toBe('Test');
    });
  });

  describe('getDetail', () => {
    let missionStore: Awaited<ReturnType<typeof getMissionStore>>;

    beforeEach(async () => {
      missionStore = await getMissionStore();
      await missionStore.init();
    });

    it('returns null for non-existent mission', async () => {
      const detail = await missionStore.getDetail('m-nonexist');
      expect(detail).toBeNull();
    });

    it('includes workflow', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      const detail = await missionStore.getDetail(created.mission_id);

      expect(detail!.workflow).toBeDefined();
      expect(detail!.workflow.workflow_id).toBe('raw-research-plan-implement');
    });

    it('includes artifacts', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      const detail = await missionStore.getDetail(created.mission_id);

      expect(detail!.artifacts).toBeDefined();
      expect(detail!.artifacts['raw-input.md']).toBe('Input');
    });

    it('includes runs (empty initially)', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      const detail = await missionStore.getDetail(created.mission_id);

      expect(detail!.runs).toBeDefined();
      expect(detail!.runs).toHaveLength(0);
    });
  });

  describe('listMissions', () => {
    let missionStore: Awaited<ReturnType<typeof getMissionStore>>;

    beforeEach(async () => {
      missionStore = await getMissionStore();
      await missionStore.init();
    });

    it('returns empty array when no missions', async () => {
      const missions = await missionStore.listMissions();
      expect(missions).toEqual([]);
    });

    it('returns MissionListItem[] with correct fields', async () => {
      await missionStore.createMission('Test', 'feature', 'Input');
      const missions = await missionStore.listMissions();

      expect(missions).toHaveLength(1);
      expect(missions[0]).toHaveProperty('mission_id');
      expect(missions[0]).toHaveProperty('title');
      expect(missions[0]).toHaveProperty('type');
      expect(missions[0]).toHaveProperty('status');
      expect(missions[0]).toHaveProperty('current_step_name');
      expect(missions[0]).toHaveProperty('updated_at');
    });

    it('sorts by updated_at desc (most recent first)', async () => {
      const m1 = await missionStore.createMission('First', 'feature', 'Input');
      await new Promise(r => setTimeout(r, 10)); // Ensure different timestamps
      const m2 = await missionStore.createMission('Second', 'feature', 'Input');

      const missions = await missionStore.listMissions();
      expect(missions[0].mission_id).toBe(m2.mission_id);
      expect(missions[1].mission_id).toBe(m1.mission_id);
    });
  });

  describe('updateMeta', () => {
    let missionStore: Awaited<ReturnType<typeof getMissionStore>>;

    beforeEach(async () => {
      missionStore = await getMissionStore();
      await missionStore.init();
    });

    it('throws for non-existent mission', async () => {
      await expect(missionStore.updateMeta('m-nonexist', { status: 'completed' }))
        .rejects.toThrow('Mission not found');
    });

    it('merges partial updates', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      await missionStore.updateMeta(created.mission_id, { status: 'running_code_agent' });

      const meta = await missionStore.getMeta(created.mission_id);
      expect(meta!.status).toBe('running_code_agent');
      expect(meta!.title).toBe('Test'); // Preserved
    });

    it('updates updated_at timestamp', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      const originalUpdatedAt = created.updated_at;

      await new Promise(r => setTimeout(r, 10));
      await missionStore.updateMeta(created.mission_id, { status: 'completed' });

      const meta = await missionStore.getMeta(created.mission_id);
      expect(meta!.updated_at > originalUpdatedAt).toBe(true);
    });
  });

  describe('artifacts', () => {
    let missionStore: Awaited<ReturnType<typeof getMissionStore>>;

    beforeEach(async () => {
      missionStore = await getMissionStore();
      await missionStore.init();
    });

    it('getArtifact returns null for non-existent artifact', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      const artifact = await missionStore.getArtifact(created.mission_id, 'nonexistent.md');
      expect(artifact).toBeNull();
    });

    it('getArtifact returns file content as string', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'My input');
      const artifact = await missionStore.getArtifact(created.mission_id, 'raw-input.md');
      expect(artifact).toBe('My input');
    });

    it('saveArtifact creates file', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      await missionStore.saveArtifact(created.mission_id, 'output.md', 'Output content');

      const artifact = await missionStore.getArtifact(created.mission_id, 'output.md');
      expect(artifact).toBe('Output content');
    });

    it('saveArtifact overwrites existing file', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      await missionStore.saveArtifact(created.mission_id, 'output.md', 'First');
      await missionStore.saveArtifact(created.mission_id, 'output.md', 'Second');

      const artifact = await missionStore.getArtifact(created.mission_id, 'output.md');
      expect(artifact).toBe('Second');
    });

    it('loadArtifacts returns Record<filename, content>', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      await missionStore.saveArtifact(created.mission_id, 'a.md', 'Content A');
      await missionStore.saveArtifact(created.mission_id, 'b.md', 'Content B');

      const artifacts = await missionStore.loadArtifacts(created.mission_id);
      expect(artifacts['raw-input.md']).toBe('Input');
      expect(artifacts['a.md']).toBe('Content A');
      expect(artifacts['b.md']).toBe('Content B');
    });
  });

  describe('runs', () => {
    let missionStore: Awaited<ReturnType<typeof getMissionStore>>;

    beforeEach(async () => {
      missionStore = await getMissionStore();
      await missionStore.init();
    });

    it('createRun returns StepRun with generated ID', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      const run = await missionStore.createRun(created.mission_id, 'cleanup');

      expect(run.run_id).toMatch(/^r-[a-f0-9]{8}$/);
      expect(run.step_id).toBe('cleanup');
    });

    it('createRun sets started_at timestamp', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      const before = new Date().toISOString();
      const run = await missionStore.createRun(created.mission_id, 'cleanup');
      const after = new Date().toISOString();

      expect(run.started_at >= before).toBe(true);
      expect(run.started_at <= after).toBe(true);
    });

    it('createRun writes run JSON file', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      const run = await missionStore.createRun(created.mission_id, 'cleanup');

      const testDir = getTestDir();
      const runPath = join(testDir, 'missions', created.mission_id, 'runs', `${run.run_id}.json`);
      expect(existsSync(runPath)).toBe(true);
    });

    it('loadRuns returns empty array when no runs', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      const runs = await missionStore.loadRuns(created.mission_id);
      expect(runs).toEqual([]);
    });

    it('loadRuns returns sorted StepRun[] by started_at', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      const run1 = await missionStore.createRun(created.mission_id, 'cleanup');
      await new Promise(r => setTimeout(r, 10));
      const run2 = await missionStore.createRun(created.mission_id, 'research');

      const runs = await missionStore.loadRuns(created.mission_id);
      expect(runs[0].run_id).toBe(run1.run_id); // Older first
      expect(runs[1].run_id).toBe(run2.run_id);
    });

    it('updateRun merges partial updates', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      const run = await missionStore.createRun(created.mission_id, 'cleanup');

      await missionStore.updateRun(created.mission_id, run.run_id, {
        finished_at: '2024-01-01T00:00:00Z',
        exit_code: 0,
      });

      const runs = await missionStore.loadRuns(created.mission_id);
      expect(runs[0].finished_at).toBe('2024-01-01T00:00:00Z');
      expect(runs[0].exit_code).toBe(0);
      expect(runs[0].step_id).toBe('cleanup'); // Preserved
    });
  });

  describe('logs', () => {
    let missionStore: Awaited<ReturnType<typeof getMissionStore>>;

    beforeEach(async () => {
      missionStore = await getMissionStore();
      await missionStore.init();
    });

    it('appendLog creates log file if not exists', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      const run = await missionStore.createRun(created.mission_id, 'cleanup');

      await missionStore.appendLog(created.mission_id, run.run_id, 'First log');

      const testDir = getTestDir();
      const logPath = join(testDir, 'missions', created.mission_id, 'logs', `${run.run_id}.log`);
      expect(existsSync(logPath)).toBe(true);
    });

    it('appendLog appends to existing log', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      const run = await missionStore.createRun(created.mission_id, 'cleanup');

      await missionStore.appendLog(created.mission_id, run.run_id, 'First');
      await missionStore.appendLog(created.mission_id, run.run_id, 'Second');

      const testDir = getTestDir();
      const logPath = join(testDir, 'missions', created.mission_id, 'logs', `${run.run_id}.log`);
      const content = await readFile(logPath, 'utf-8');
      expect(content).toBe('FirstSecond');
    });

    it('getLogTail returns empty string for non-existent log', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      const tail = await missionStore.getLogTail(created.mission_id, 'r-nonexist');
      expect(tail).toBe('');
    });

    it('getLogTail returns last N bytes', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      const run = await missionStore.createRun(created.mission_id, 'cleanup');

      await missionStore.appendLog(created.mission_id, run.run_id, 'A'.repeat(100));

      const tail = await missionStore.getLogTail(created.mission_id, run.run_id, 50);
      expect(tail).toHaveLength(50);
      expect(tail).toBe('A'.repeat(50));
    });
  });

  describe('appendDockerStdout', () => {
    let missionStore: Awaited<ReturnType<typeof getMissionStore>>;

    beforeEach(async () => {
      missionStore = await getMissionStore();
      await missionStore.init();
    });

    it('should create docker stdout log file', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'test');
      const run = await missionStore.createRun(created.mission_id, 'cleanup');

      await missionStore.appendDockerStdout(created.mission_id, run.run_id, 'raw stdout line 1\n');

      const testDir = getTestDir();
      const logPath = join(testDir, 'missions', created.mission_id, 'logs', `${run.run_id}-docker-stdout.log`);
      expect(existsSync(logPath)).toBe(true);
      const content = await readFile(logPath, 'utf-8');
      expect(content).toBe('raw stdout line 1\n');
    });

    it('should append to existing docker stdout log', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'test');
      const run = await missionStore.createRun(created.mission_id, 'cleanup');

      await missionStore.appendDockerStdout(created.mission_id, run.run_id, 'line 1\n');
      await missionStore.appendDockerStdout(created.mission_id, run.run_id, 'line 2\n');

      const testDir = getTestDir();
      const logPath = join(testDir, 'missions', created.mission_id, 'logs', `${run.run_id}-docker-stdout.log`);
      const content = await readFile(logPath, 'utf-8');
      expect(content).toBe('line 1\nline 2\n');
    });
  });

  describe('appendDockerStderr', () => {
    let missionStore: Awaited<ReturnType<typeof getMissionStore>>;

    beforeEach(async () => {
      missionStore = await getMissionStore();
      await missionStore.init();
    });

    it('should create docker stderr log file', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'test');
      const run = await missionStore.createRun(created.mission_id, 'cleanup');

      await missionStore.appendDockerStderr(created.mission_id, run.run_id, 'error output\n');

      const testDir = getTestDir();
      const logPath = join(testDir, 'missions', created.mission_id, 'logs', `${run.run_id}-docker-stderr.log`);
      expect(existsSync(logPath)).toBe(true);
      const content = await readFile(logPath, 'utf-8');
      expect(content).toBe('error output\n');
    });
  });
});
