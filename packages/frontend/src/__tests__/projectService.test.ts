/**
 * Tests for projectService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readProjectState } from '../services/projectService.js';
import type { ProjectState, ProjectDisplayInfo } from '@haflow/shared';

describe('projectService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('readProjectState', () => {
    it('should return unlinked state when file does not exist', async () => {
      // Mock fs.promises.readFile to throw ENOENT
      vi.doMock('fs/promises', () => ({
        readFile: vi.fn().mockRejectedValue({ code: 'ENOENT' }),
      }));

      const result = await readProjectState();

      expect(result.status).toBe('unlinked');
      expect(result.project).toBeNull();
    });

    it('should handle invalid JSON gracefully', async () => {
      vi.doMock('fs/promises', () => ({
        readFile: vi.fn().mockResolvedValue('invalid json {'),
      }));

      const result = await readProjectState();

      expect(result.status).toBe('error');
      expect(result.errorMessage).toContain('Invalid state file format');
    });

    it('should validate project state structure', async () => {
      const mockState = {
        version: 1,
        lastUpdated: Date.now(),
        linkedProject: {
          id: 'test-123',
          name: 'test',
          path: '/path',
          linkedAt: Date.now(),
        },
      };

      vi.doMock('fs/promises', () => ({
        readFile: vi.fn().mockResolvedValue(JSON.stringify(mockState)),
      }));

      const result = await readProjectState();

      expect(result.project).toBeDefined();
      expect(result.status).toBe('linked');
    });

    it('should detect missing project path', async () => {
      const mockState: ProjectState = {
        version: 1,
        lastUpdated: Date.now(),
        linkedProject: {
          id: 'test-123',
          name: 'test',
          path: '/path/that/does/not/exist',
          linkedAt: Date.now(),
        },
      };

      vi.doMock('fs/promises', () => ({
        readFile: vi.fn().mockResolvedValue(JSON.stringify(mockState)),
      }));

      vi.doMock('fs', () => ({
        existsSync: vi.fn().mockReturnValue(false),
      }));

      const result = await readProjectState();

      expect(result.status).toBe('missing');
      expect(result.errorMessage).toContain('not found');
    });

    it('should return linked state with valid project', async () => {
      const mockState: ProjectState = {
        version: 1,
        lastUpdated: Date.now(),
        linkedProject: {
          id: 'test-123',
          name: 'my-project',
          path: '/home/user/my-project',
          linkedAt: Date.now() - 10000,
        },
      };

      vi.doMock('fs/promises', () => ({
        readFile: vi.fn().mockResolvedValue(JSON.stringify(mockState)),
      }));

      vi.doMock('fs', () => ({
        existsSync: vi.fn().mockReturnValue(true),
      }));

      const result = await readProjectState();

      expect(result.status).toBe('linked');
      expect(result.project?.name).toBe('my-project');
      expect(result.project?.id).toBe('test-123');
    });

    it('should include lastSyncTime in response', async () => {
      vi.doMock('fs/promises', () => ({
        readFile: vi.fn().mockRejectedValue({ code: 'ENOENT' }),
      }));

      const beforeTime = Date.now();
      const result = await readProjectState();
      const afterTime = Date.now();

      expect(result.lastSyncTime).toBeGreaterThanOrEqual(beforeTime);
      expect(result.lastSyncTime).toBeLessThanOrEqual(afterTime);
    });

    it('should validate required fields in linkedProject', async () => {
      const invalidState = {
        version: 1,
        lastUpdated: Date.now(),
        linkedProject: {
          // Missing required fields
          id: 'test-123',
        },
      };

      vi.doMock('fs/promises', () => ({
        readFile: vi.fn().mockResolvedValue(JSON.stringify(invalidState)),
      }));

      const result = await readProjectState();

      expect(result.status).toBe('error');
      expect(result.errorMessage).toContain('invalid');
    });

    it('should handle file read errors', async () => {
      vi.doMock('fs/promises', () => ({
        readFile: vi.fn().mockRejectedValue(new Error('Permission denied')),
      }));

      const result = await readProjectState();

      expect(result.status).toBe('error');
      expect(result.errorMessage).toContain('Failed to read project state');
    });

    it('should preserve workspaceId field', async () => {
      const mockState: ProjectState = {
        version: 1,
        lastUpdated: Date.now(),
        linkedProject: {
          id: 'test-123',
          name: 'test',
          path: '/path',
          linkedAt: Date.now(),
          workspaceId: 'ws-456',
        },
      };

      vi.doMock('fs/promises', () => ({
        readFile: vi.fn().mockResolvedValue(JSON.stringify(mockState)),
      }));

      vi.doMock('fs', () => ({
        existsSync: vi.fn().mockReturnValue(true),
      }));

      const result = await readProjectState();

      expect(result.project?.workspaceId).toBe('ws-456');
    });

    it('should handle empty linkedProject (null)', async () => {
      const mockState: ProjectState = {
        version: 1,
        lastUpdated: Date.now(),
        linkedProject: null,
      };

      vi.doMock('fs/promises', () => ({
        readFile: vi.fn().mockResolvedValue(JSON.stringify(mockState)),
      }));

      const result = await readProjectState();

      expect(result.status).toBe('unlinked');
      expect(result.project).toBeNull();
    });

    it('should validate all required fields in state', async () => {
      const invalidState = {
        // Missing version
        lastUpdated: Date.now(),
        linkedProject: null,
      };

      vi.doMock('fs/promises', () => ({
        readFile: vi.fn().mockResolvedValue(JSON.stringify(invalidState)),
      }));

      const result = await readProjectState();

      expect(result.status).toBe('error');
      expect(result.errorMessage).toContain('invalid');
    });
  });
});
