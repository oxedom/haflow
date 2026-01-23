import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { dockerProvider } from '../../../src/services/docker.js';
import { getTestDir } from '../../setup.js';

describe('docker provider', () => {
  let dockerAvailable: boolean;
  const createdContainers: string[] = [];

  beforeAll(async () => {
    dockerAvailable = await dockerProvider.isAvailable();
    if (!dockerAvailable) {
      console.warn('Docker not available - skipping Docker tests');
    }
  });

  afterEach(async () => {
    // Cleanup containers created during tests
    for (const id of createdContainers) {
      await dockerProvider.remove(id).catch(() => {});
    }
    createdContainers.length = 0;
  });

  describe('isAvailable', () => {
    it('returns true when docker works', async () => {
      // This test validates the environment
      const available = await dockerProvider.isAvailable();
      expect(typeof available).toBe('boolean');
    });
  });

  describe('start', () => {
    it('returns container ID from stdout', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'artifacts');
      await mkdir(artifactsPath, { recursive: true });

      const containerId = await dockerProvider.start({
        missionId: 'm-test1234',
        runId: 'r-test1234',
        stepId: 'test-step',
        image: 'alpine:latest',
        artifactsPath,
        command: ['echo', 'hello'],
      });

      createdContainers.push(containerId);
      expect(containerId).toBeTruthy();
      expect(containerId.length).toBeGreaterThan(10);
    });

    it('includes all labels', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'artifacts');
      await mkdir(artifactsPath, { recursive: true });

      const containerId = await dockerProvider.start({
        missionId: 'm-labeltest',
        runId: 'r-labeltest',
        stepId: 'label-step',
        image: 'alpine:latest',
        artifactsPath,
        command: ['sleep', '10'],
      });

      createdContainers.push(containerId);

      // Inspect container to verify labels
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const { stdout } = await execAsync(`docker inspect --format='{{json .Config.Labels}}' ${containerId}`);
      const labels = JSON.parse(stdout.trim());

      expect(labels['haloop.mission_id']).toBe('m-labeltest');
      expect(labels['haloop.run_id']).toBe('r-labeltest');
      expect(labels['haloop.step_id']).toBe('label-step');
    });

    it('mounts artifacts volume', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'artifacts');
      await mkdir(artifactsPath, { recursive: true });
      await writeFile(join(artifactsPath, 'test.txt'), 'test content');

      const containerId = await dockerProvider.start({
        missionId: 'm-mount',
        runId: 'r-mount',
        stepId: 'mount-step',
        image: 'alpine:latest',
        artifactsPath,
        command: ['cat', '/mission/artifacts/test.txt'],
      });

      createdContainers.push(containerId);

      // Wait for container to finish
      await new Promise(r => setTimeout(r, 2000));

      const logs = await dockerProvider.getLogTail(containerId);
      expect(logs).toContain('test content');
    });

    it('shell-escapes sh -c commands', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'artifacts');
      await mkdir(artifactsPath, { recursive: true });

      // Command with special characters that need escaping
      const containerId = await dockerProvider.start({
        missionId: 'm-escape',
        runId: 'r-escape',
        stepId: 'escape-step',
        image: 'alpine:latest',
        artifactsPath,
        command: ['sh', '-c', 'echo "hello world" && echo "done"'],
      });

      createdContainers.push(containerId);

      // Wait for container to finish
      await new Promise(r => setTimeout(r, 2000));

      const logs = await dockerProvider.getLogTail(containerId);
      expect(logs).toContain('hello world');
      expect(logs).toContain('done');
    });
  });

  describe('getStatus', () => {
    it('parses running state', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'artifacts');
      await mkdir(artifactsPath, { recursive: true });

      const containerId = await dockerProvider.start({
        missionId: 'm-running',
        runId: 'r-running',
        stepId: 'running-step',
        image: 'alpine:latest',
        artifactsPath,
        command: ['sleep', '30'],
      });

      createdContainers.push(containerId);

      const status = await dockerProvider.getStatus(containerId);
      expect(status.state).toBe('running');
    });

    it('parses exited state with exit code', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'artifacts');
      await mkdir(artifactsPath, { recursive: true });

      const containerId = await dockerProvider.start({
        missionId: 'm-exited',
        runId: 'r-exited',
        stepId: 'exited-step',
        image: 'alpine:latest',
        artifactsPath,
        command: ['sh', '-c', 'exit 42'],
      });

      createdContainers.push(containerId);

      // Wait for container to exit
      await new Promise(r => setTimeout(r, 2000));

      const status = await dockerProvider.getStatus(containerId);
      expect(status.state).toBe('exited');
      expect(status.exitCode).toBe(42);
    });

    it('returns unknown on error', async () => {
      const status = await dockerProvider.getStatus('nonexistent-container-id');
      expect(status.state).toBe('unknown');
    });

    it('parses timestamps', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'artifacts');
      await mkdir(artifactsPath, { recursive: true });

      const containerId = await dockerProvider.start({
        missionId: 'm-timestamps',
        runId: 'r-timestamps',
        stepId: 'timestamps-step',
        image: 'alpine:latest',
        artifactsPath,
        command: ['echo', 'done'],
      });

      createdContainers.push(containerId);

      // Wait for container to exit
      await new Promise(r => setTimeout(r, 2000));

      const status = await dockerProvider.getStatus(containerId);
      expect(status.startedAt).toBeDefined();
      expect(status.finishedAt).toBeDefined();
    });
  });

  describe('getLogTail', () => {
    it('returns stdout from docker logs', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'artifacts');
      await mkdir(artifactsPath, { recursive: true });

      const containerId = await dockerProvider.start({
        missionId: 'm-logs',
        runId: 'r-logs',
        stepId: 'logs-step',
        image: 'alpine:latest',
        artifactsPath,
        command: ['echo', 'test output'],
      });

      createdContainers.push(containerId);

      // Wait for container to finish
      await new Promise(r => setTimeout(r, 2000));

      const logs = await dockerProvider.getLogTail(containerId);
      expect(logs).toContain('test output');
    });

    it('slices to byte limit', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'artifacts');
      await mkdir(artifactsPath, { recursive: true });

      const containerId = await dockerProvider.start({
        missionId: 'm-longlog',
        runId: 'r-longlog',
        stepId: 'longlog-step',
        image: 'alpine:latest',
        artifactsPath,
        command: ['sh', '-c', 'for i in $(seq 1 1000); do echo "line $i"; done'],
      });

      createdContainers.push(containerId);

      // Wait for container to finish
      await new Promise(r => setTimeout(r, 3000));

      const logs = await dockerProvider.getLogTail(containerId, 100);
      expect(logs.length).toBeLessThanOrEqual(100);
    });

    it('returns empty string on error', async () => {
      const logs = await dockerProvider.getLogTail('nonexistent-container-id');
      expect(logs).toBe('');
    });
  });

  describe('stop', () => {
    it('calls docker stop', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'artifacts');
      await mkdir(artifactsPath, { recursive: true });

      const containerId = await dockerProvider.start({
        missionId: 'm-stop',
        runId: 'r-stop',
        stepId: 'stop-step',
        image: 'alpine:latest',
        artifactsPath,
        command: ['sleep', '60'],
      });

      createdContainers.push(containerId);

      // Verify running
      let status = await dockerProvider.getStatus(containerId);
      expect(status.state).toBe('running');

      // Stop
      await dockerProvider.stop(containerId);

      // Verify stopped
      await new Promise(r => setTimeout(r, 1000));
      status = await dockerProvider.getStatus(containerId);
      expect(status.state).toBe('exited');
    });

    it('ignores errors for already stopped containers', async () => {
      // Should not throw
      await dockerProvider.stop('nonexistent-container');
    });
  });

  describe('remove', () => {
    it('calls docker rm -f', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'artifacts');
      await mkdir(artifactsPath, { recursive: true });

      const containerId = await dockerProvider.start({
        missionId: 'm-remove',
        runId: 'r-remove',
        stepId: 'remove-step',
        image: 'alpine:latest',
        artifactsPath,
        command: ['echo', 'done'],
      });

      // Don't add to createdContainers since we're removing it

      await dockerProvider.remove(containerId);

      // Verify removed
      const status = await dockerProvider.getStatus(containerId);
      expect(status.state).toBe('unknown');
    });

    it('ignores errors for already removed containers', async () => {
      // Should not throw
      await dockerProvider.remove('nonexistent-container');
    });
  });

  describe('cleanupOrphaned', () => {
    it('finds and removes containers by label filter', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'artifacts');
      await mkdir(artifactsPath, { recursive: true });

      // Create a container
      const containerId = await dockerProvider.start({
        missionId: 'm-orphan',
        runId: 'r-orphan',
        stepId: 'orphan-step',
        image: 'alpine:latest',
        artifactsPath,
        command: ['sleep', '60'],
      });

      // Don't add to createdContainers - cleanupOrphaned should handle it

      // Run cleanup
      await dockerProvider.cleanupOrphaned();

      // Verify removed
      const status = await dockerProvider.getStatus(containerId);
      expect(status.state).toBe('unknown');
    });
  });
});
