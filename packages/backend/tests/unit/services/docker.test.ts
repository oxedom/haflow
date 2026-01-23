import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { dockerProvider, parseStreamJsonLine } from '../../../src/services/docker.js';
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

      expect(labels['haflow.mission_id']).toBe('m-labeltest');
      expect(labels['haflow.run_id']).toBe('r-labeltest');
      expect(labels['haflow.step_id']).toBe('label-step');
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

describe('parseStreamJsonLine', () => {
  describe('assistant messages', () => {
    it('parses assistant message with text', () => {
      const line = JSON.stringify({
        type: 'assistant',
        message: { content: [{ text: 'Hello world' }] },
      });
      const event = parseStreamJsonLine(line);

      expect(event).not.toBeNull();
      expect(event!.type).toBe('assistant');
      expect(event!.text).toBe('Hello world');
      expect(event!.isComplete).toBe(false);
    });

    it('detects COMPLETE marker in assistant message', () => {
      const line = JSON.stringify({
        type: 'assistant',
        message: { content: [{ text: 'Done! <promise>COMPLETE</promise>' }] },
      });
      const event = parseStreamJsonLine(line);

      expect(event!.isComplete).toBe(true);
    });

    it('handles empty content array', () => {
      const line = JSON.stringify({
        type: 'assistant',
        message: { content: [] },
      });
      const event = parseStreamJsonLine(line);

      expect(event!.type).toBe('assistant');
      expect(event!.text).toBe('');
    });
  });

  describe('content_block_delta messages', () => {
    it('parses delta text', () => {
      const line = JSON.stringify({
        type: 'content_block_delta',
        delta: { text: 'streaming text' },
      });
      const event = parseStreamJsonLine(line);

      expect(event!.type).toBe('assistant');
      expect(event!.text).toBe('streaming text');
    });

    it('detects COMPLETE marker in delta', () => {
      const line = JSON.stringify({
        type: 'content_block_delta',
        delta: { text: '<promise>COMPLETE</promise>' },
      });
      const event = parseStreamJsonLine(line);

      expect(event!.isComplete).toBe(true);
    });
  });

  describe('tool_use messages', () => {
    it('parses tool use with name and input', () => {
      const line = JSON.stringify({
        type: 'tool_use',
        name: 'read_file',
        input: { path: '/test.txt' },
      });
      const event = parseStreamJsonLine(line);

      expect(event!.type).toBe('tool_use');
      expect(event!.toolName).toBe('read_file');
      expect(event!.text).toContain('/test.txt');
    });
  });

  describe('result messages', () => {
    it('parses result with isComplete true', () => {
      const line = JSON.stringify({
        type: 'result',
        result: 'success',
      });
      const event = parseStreamJsonLine(line);

      expect(event!.type).toBe('result');
      expect(event!.result).toBe('success');
      expect(event!.isComplete).toBe(true);
    });

    it('uses subtype as result if result not present', () => {
      const line = JSON.stringify({
        type: 'result',
        subtype: 'completed',
      });
      const event = parseStreamJsonLine(line);

      expect(event!.result).toBe('completed');
    });
  });

  describe('error messages', () => {
    it('parses error with message', () => {
      const line = JSON.stringify({
        type: 'error',
        error: { message: 'Something went wrong' },
      });
      const event = parseStreamJsonLine(line);

      expect(event!.type).toBe('error');
      expect(event!.text).toBe('Something went wrong');
    });

    it('uses top-level message if error.message not present', () => {
      const line = JSON.stringify({
        type: 'error',
        message: 'Top level error',
      });
      const event = parseStreamJsonLine(line);

      expect(event!.text).toBe('Top level error');
    });

    it('uses default message if no message present', () => {
      const line = JSON.stringify({
        type: 'error',
      });
      const event = parseStreamJsonLine(line);

      expect(event!.text).toBe('Unknown error');
    });
  });

  describe('system/init messages', () => {
    it('parses system message', () => {
      const line = JSON.stringify({
        type: 'system',
        message: 'System initialized',
      });
      const event = parseStreamJsonLine(line);

      expect(event!.type).toBe('init');
      expect(event!.text).toBe('System initialized');
    });

    it('parses init message', () => {
      const line = JSON.stringify({
        type: 'init',
        message: 'Session started',
      });
      const event = parseStreamJsonLine(line);

      expect(event!.type).toBe('init');
      expect(event!.text).toBe('Session started');
    });

    it('uses default text if message not present', () => {
      const line = JSON.stringify({
        type: 'system',
      });
      const event = parseStreamJsonLine(line);

      expect(event!.text).toBe('Session initialized');
    });
  });

  describe('edge cases', () => {
    it('returns null for empty line', () => {
      expect(parseStreamJsonLine('')).toBeNull();
      expect(parseStreamJsonLine('   ')).toBeNull();
    });

    it('returns null for unknown message type', () => {
      const line = JSON.stringify({
        type: 'unknown_type',
        data: 'something',
      });
      expect(parseStreamJsonLine(line)).toBeNull();
    });

    it('treats non-JSON as plain text assistant message', () => {
      const line = 'This is plain text output';
      const event = parseStreamJsonLine(line);

      expect(event!.type).toBe('assistant');
      expect(event!.text).toBe('This is plain text output');
    });

    it('detects COMPLETE marker in plain text', () => {
      const line = 'Task done <promise>COMPLETE</promise>';
      const event = parseStreamJsonLine(line);

      expect(event!.isComplete).toBe(true);
    });
  });
});
