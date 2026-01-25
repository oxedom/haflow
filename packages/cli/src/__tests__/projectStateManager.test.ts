/**
 * Tests for ProjectStateManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdir, rm, writeFile, readFile, stat } from 'fs/promises';
import { dirname, join } from 'path';
import { ProjectStateManager } from '../projectStateManager.js';
import type { LinkedProject, ProjectState } from '@haflow/shared';

// Create a temporary directory for tests
const testDir = join(import.meta.dirname, '..', '..', '.test-state');

// Mock getStateFilePath to use test directory
vi.mock('@haflow/shared', async () => {
  const actual = await vi.importActual('@haflow/shared');
  return {
    ...actual,
    getStateFilePath: () => join(testDir, 'project-state.json'),
  };
});

describe('ProjectStateManager', () => {
  let stateManager: ProjectStateManager;

  beforeEach(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
    // Create fresh instance
    stateManager = new ProjectStateManager();
  });

  it('should create state file directory if it does not exist', async () => {
    const testProject: LinkedProject = {
      id: 'test-123',
      name: 'test-project',
      path: '/path/to/project',
      linkedAt: Date.now(),
    };

    await stateManager.setLinkedProject(testProject);

    // Verify directory was created
    const statResult = await stat(testDir);
    expect(statResult.isDirectory()).toBe(true);
  });

  it('should write and read state file successfully', async () => {
    const testProject: LinkedProject = {
      id: 'test-123',
      name: 'test-project',
      path: '/path/to/project',
      linkedAt: Date.now(),
    };

    await stateManager.setLinkedProject(testProject);

    const linkedProject = await stateManager.getLinkedProject();
    expect(linkedProject).toEqual(testProject);
  });

  it('should return null for non-existent state file', async () => {
    const linkedProject = await stateManager.getLinkedProject();
    expect(linkedProject).toBeNull();
  });

  it('should set file permissions to 0600 (owner read/write only)', async () => {
    const testProject: LinkedProject = {
      id: 'test-123',
      name: 'test-project',
      path: '/path/to/project',
      linkedAt: Date.now(),
    };

    await stateManager.setLinkedProject(testProject);

    const stateFilePath = stateManager.getStateFilePath();
    const statResult = await stat(stateFilePath);

    // Check permissions are 0600 (owner read/write only)
    // mode & 0o777 gives us the permission bits
    const mode = statResult.mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('should update lastUpdated timestamp', async () => {
    const beforeTime = Date.now();
    const testProject: LinkedProject = {
      id: 'test-123',
      name: 'test-project',
      path: '/path/to/project',
      linkedAt: Date.now(),
    };

    await stateManager.setLinkedProject(testProject);

    const state = await stateManager.getState();
    expect(state.lastUpdated).toBeGreaterThanOrEqual(beforeTime);
    expect(state.lastUpdated).toBeLessThanOrEqual(Date.now());
  });

  it('should clear linked project', async () => {
    const testProject: LinkedProject = {
      id: 'test-123',
      name: 'test-project',
      path: '/path/to/project',
      linkedAt: Date.now(),
    };

    // Set project
    await stateManager.setLinkedProject(testProject);
    expect(await stateManager.getLinkedProject()).toEqual(testProject);

    // Clear project
    await stateManager.clearLinkedProject();
    expect(await stateManager.getLinkedProject()).toBeNull();

    // State file should still exist
    const state = await stateManager.getState();
    expect(state.linkedProject).toBeNull();
    expect(state.version).toBe(1);
  });

  it('should include version field in state', async () => {
    const testProject: LinkedProject = {
      id: 'test-123',
      name: 'test-project',
      path: '/path/to/project',
      linkedAt: Date.now(),
    };

    await stateManager.setLinkedProject(testProject);

    const state = await stateManager.getState();
    expect(state.version).toBe(1);
  });

  it('should handle invalid JSON gracefully', async () => {
    const stateFilePath = stateManager.getStateFilePath();
    const dir = dirname(stateFilePath);

    // Create directory
    await mkdir(dir, { recursive: true });

    // Write invalid JSON
    await writeFile(stateFilePath, 'invalid json {');

    // Should throw error about invalid JSON
    await expect(stateManager.getState()).rejects.toThrow('Invalid JSON');
  });

  it('should handle file read errors', async () => {
    const stateFilePath = stateManager.getStateFilePath();

    // Try to read non-existent file
    await expect(stateManager.getState()).rejects.toThrow();
  });

  it('should return correct state file path', () => {
    const stateFilePath = stateManager.getStateFilePath();
    expect(stateFilePath).toContain('project-state.json');
  });

  it('should perform atomic writes without corruption', async () => {
    const testProject1: LinkedProject = {
      id: 'test-123',
      name: 'project-1',
      path: '/path/to/project1',
      linkedAt: Date.now(),
    };

    const testProject2: LinkedProject = {
      id: 'test-456',
      name: 'project-2',
      path: '/path/to/project2',
      linkedAt: Date.now() + 1000,
    };

    // Write first project
    await stateManager.setLinkedProject(testProject1);

    // Verify write
    let state = await stateManager.getState();
    expect(state.linkedProject?.id).toBe('test-123');

    // Write second project (atomic operation)
    await stateManager.setLinkedProject(testProject2);

    // Verify only second project exists (no partial writes)
    state = await stateManager.getState();
    expect(state.linkedProject?.id).toBe('test-456');
    expect(state.linkedProject?.name).toBe('project-2');
  });

  it('should handle multiple rapid writes', async () => {
    const projects: LinkedProject[] = Array.from({ length: 5 }, (_, i) => ({
      id: `test-${i}`,
      name: `project-${i}`,
      path: `/path/to/project${i}`,
      linkedAt: Date.now() + i * 100,
    }));

    // Write all projects rapidly
    await Promise.all(projects.map((p) => stateManager.setLinkedProject(p)));

    // Last one written should be in state
    const state = await stateManager.getState();
    expect(state.linkedProject?.id).toMatch(/^test-/);
  });

  it('should maintain optional workspaceId field', async () => {
    const testProject: LinkedProject = {
      id: 'test-123',
      name: 'test-project',
      path: '/path/to/project',
      linkedAt: Date.now(),
      workspaceId: 'ws-456',
    };

    await stateManager.setLinkedProject(testProject);

    const linkedProject = await stateManager.getLinkedProject();
    expect(linkedProject?.workspaceId).toBe('ws-456');
  });
});
