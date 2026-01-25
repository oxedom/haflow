/**
 * Integration Tests: CLI and Frontend Synchronization
 * Tests the end-to-end flow of project linking and synchronization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, rm, writeFile, readFile, stat } from 'fs/promises';
import { dirname, join } from 'path';
import { ProjectStateManager } from '../../cli/src/projectStateManager.js';
import { readProjectState } from '../../frontend/src/services/projectService.js';
import type { LinkedProject } from '@haflow/shared';

// Test directory
const testDir = join(import.meta.dirname, '.test-cli-frontend-sync');
const stateFilePath = join(testDir, 'project-state.json');

// Mock getStateFilePath in both modules
vi.mock('@haflow/shared', async () => {
  const actual = await vi.importActual('@haflow/shared');
  return {
    ...actual,
    getStateFilePath: () => stateFilePath,
  };
});

describe('CLI-Frontend Synchronization', () => {
  beforeEach(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  describe('Scenario 1: Link Project', () => {
    it('should create state file with correct structure when project is linked', async () => {
      const stateManager = new ProjectStateManager();

      const testProject: LinkedProject = {
        id: 'test-123',
        name: 'test-project',
        path: '/path/to/project',
        linkedAt: Date.now(),
      };

      // CLI links project
      await stateManager.setLinkedProject(testProject);

      // Frontend reads state
      const displayInfo = await readProjectState();

      // Verify structure and data
      expect(displayInfo.status).toBe('linked');
      expect(displayInfo.project).toEqual(testProject);
      expect(displayInfo.lastSyncTime).toBeDefined();
    });

    it('should have correct file permissions after linking', async () => {
      const stateManager = new ProjectStateManager();

      const testProject: LinkedProject = {
        id: 'test-123',
        name: 'test-project',
        path: '/path/to/project',
        linkedAt: Date.now(),
      };

      await stateManager.setLinkedProject(testProject);

      // Check file permissions
      const statResult = await stat(stateFilePath);
      const mode = statResult.mode & 0o777;

      // Should be 0600 (owner read/write only)
      expect(mode).toBe(0o600);
    });
  });

  describe('Scenario 2: Update Project', () => {
    it('should detect state change when project is unlinked', async () => {
      const stateManager = new ProjectStateManager();

      const testProject: LinkedProject = {
        id: 'test-123',
        name: 'test-project',
        path: '/path/to/project',
        linkedAt: Date.now(),
      };

      // CLI links project
      await stateManager.setLinkedProject(testProject);

      // Frontend reads linked state
      let displayInfo = await readProjectState();
      expect(displayInfo.status).toBe('linked');

      // CLI unlinks project
      await stateManager.clearLinkedProject();

      // Frontend reads unlinked state
      displayInfo = await readProjectState();
      expect(displayInfo.status).toBe('unlinked');
      expect(displayInfo.project).toBeNull();
    });

    it('should update lastUpdated timestamp on each change', async () => {
      const stateManager = new ProjectStateManager();

      const testProject1: LinkedProject = {
        id: 'test-123',
        name: 'project-1',
        path: '/path/to/project1',
        linkedAt: Date.now(),
      };

      // First write
      await stateManager.setLinkedProject(testProject1);
      let state = await readProjectState();
      const firstSyncTime = state.lastSyncTime;

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      const testProject2: LinkedProject = {
        id: 'test-456',
        name: 'project-2',
        path: '/path/to/project2',
        linkedAt: Date.now(),
      };

      // Second write
      await stateManager.setLinkedProject(testProject2);
      state = await readProjectState();

      // lastSyncTime should be updated
      expect(state.lastSyncTime).toBeGreaterThan(firstSyncTime);
    });
  });

  describe('Scenario 3: Error Recovery', () => {
    it('should handle invalid JSON gracefully', async () => {
      // Create directory
      await mkdir(dirname(stateFilePath), { recursive: true });

      // Write invalid JSON
      await writeFile(stateFilePath, 'invalid json {');

      // Frontend should detect error
      const displayInfo = await readProjectState();
      expect(displayInfo.status).toBe('error');
      expect(displayInfo.errorMessage).toContain('Invalid');
    });

    it('should recover after fixing state file', async () => {
      const stateManager = new ProjectStateManager();

      // Create directory
      await mkdir(dirname(stateFilePath), { recursive: true });

      // Write invalid JSON
      await writeFile(stateFilePath, 'invalid json {');

      // Frontend detects error
      let displayInfo = await readProjectState();
      expect(displayInfo.status).toBe('error');

      // CLI corrects state file
      const testProject: LinkedProject = {
        id: 'test-123',
        name: 'test-project',
        path: '/path/to/project',
        linkedAt: Date.now(),
      };

      await stateManager.setLinkedProject(testProject);

      // Frontend recovers
      displayInfo = await readProjectState();
      expect(displayInfo.status).toBe('linked');
      expect(displayInfo.project?.name).toBe('test-project');
    });

    it('should handle missing project directory', async () => {
      const stateManager = new ProjectStateManager();

      // Create state with non-existent path
      const testProject: LinkedProject = {
        id: 'test-123',
        name: 'missing-project',
        path: '/path/that/does/not/exist/12345',
        linkedAt: Date.now(),
      };

      await stateManager.setLinkedProject(testProject);

      // Frontend should detect missing status
      const displayInfo = await readProjectState();
      expect(displayInfo.status).toBe('missing');
      expect(displayInfo.errorMessage).toContain('not found');
    });
  });

  describe('Scenario 4: Data Integrity', () => {
    it('should preserve all project fields through read/write cycle', async () => {
      const stateManager = new ProjectStateManager();

      const testProject: LinkedProject = {
        id: 'abc-def-ghi-123',
        name: 'my-complex-project',
        path: '/home/user/projects/my-complex-project',
        linkedAt: 1609459200000, // Fixed timestamp
        workspaceId: 'workspace-xyz',
      };

      // CLI writes project
      await stateManager.setLinkedProject(testProject);

      // Frontend reads project
      const displayInfo = await readProjectState();

      // Verify all fields
      expect(displayInfo.project?.id).toBe(testProject.id);
      expect(displayInfo.project?.name).toBe(testProject.name);
      expect(displayInfo.project?.path).toBe(testProject.path);
      expect(displayInfo.project?.linkedAt).toBe(testProject.linkedAt);
      expect(displayInfo.project?.workspaceId).toBe(testProject.workspaceId);
    });

    it('should ensure atomic writes prevent partial updates', async () => {
      const stateManager = new ProjectStateManager();

      const testProject1: LinkedProject = {
        id: 'test-1',
        name: 'project-1',
        path: '/path/1',
        linkedAt: Date.now(),
      };

      const testProject2: LinkedProject = {
        id: 'test-2',
        name: 'project-2',
        path: '/path/2',
        linkedAt: Date.now() + 1000,
      };

      // Rapid writes
      await Promise.all([
        stateManager.setLinkedProject(testProject1),
        stateManager.setLinkedProject(testProject2),
      ]);

      // Should have one complete project (no partial data)
      const displayInfo = await readProjectState();
      expect(displayInfo.project).toBeDefined();
      expect(displayInfo.project?.id).toMatch(/^test-[12]$/);

      // Verify data is complete (not corrupted)
      expect(displayInfo.project?.name).toBeDefined();
      expect(displayInfo.project?.path).toBeDefined();
    });
  });
});
