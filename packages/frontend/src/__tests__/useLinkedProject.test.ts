/**
 * Tests for useLinkedProject hook
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useLinkedProject } from '../hooks/useLinkedProject.js';
import * as projectService from '../services/projectService.js';
import type { ProjectDisplayInfo } from '@haflow/shared';

// Mock the projectService
vi.mock('../services/projectService.js', () => ({
  readProjectState: vi.fn(),
  watchProjectState: vi.fn(),
  getProjectStateFilePath: vi.fn(),
}));

describe('useLinkedProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with loading state', () => {
    const mockState: ProjectDisplayInfo = {
      project: null,
      status: 'unlinked',
      lastSyncTime: Date.now(),
    };

    vi.mocked(projectService.readProjectState).mockResolvedValue(mockState);
    vi.mocked(projectService.watchProjectState).mockResolvedValue(() => {
      /* no-op */
    });

    const { result } = renderHook(() => useLinkedProject());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should load initial state on mount', async () => {
    const mockState: ProjectDisplayInfo = {
      project: {
        id: 'test-123',
        name: 'test-project',
        path: '/path/to/project',
        linkedAt: Date.now(),
      },
      status: 'linked',
      lastSyncTime: Date.now(),
    };

    vi.mocked(projectService.readProjectState).mockResolvedValue(mockState);
    vi.mocked(projectService.watchProjectState).mockResolvedValue(() => {
      /* no-op */
    });

    const { result } = renderHook(() => useLinkedProject());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockState);
  });

  it('should handle errors gracefully', async () => {
    const mockError = new Error('Failed to read state');
    vi.mocked(projectService.readProjectState).mockRejectedValue(mockError);
    vi.mocked(projectService.watchProjectState).mockResolvedValue(() => {
      /* no-op */
    });

    const { result } = renderHook(() => useLinkedProject());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeDefined();
  });

  it('should set up file watcher on mount', async () => {
    const mockState: ProjectDisplayInfo = {
      project: null,
      status: 'unlinked',
      lastSyncTime: Date.now(),
    };

    vi.mocked(projectService.readProjectState).mockResolvedValue(mockState);
    const mockUnwatch = vi.fn();
    vi.mocked(projectService.watchProjectState).mockResolvedValue(mockUnwatch);

    const { result, unmount } = renderHook(() => useLinkedProject());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(projectService.watchProjectState).toHaveBeenCalled();

    unmount();
    expect(mockUnwatch).toHaveBeenCalled();
  });

  it('should update state when file changes', async () => {
    const initialState: ProjectDisplayInfo = {
      project: null,
      status: 'unlinked',
      lastSyncTime: Date.now(),
    };

    const updatedState: ProjectDisplayInfo = {
      project: {
        id: 'test-123',
        name: 'test-project',
        path: '/path/to/project',
        linkedAt: Date.now(),
      },
      status: 'linked',
      lastSyncTime: Date.now() + 1000,
    };

    let watchCallback: ((state: ProjectDisplayInfo) => void) | null = null;

    vi.mocked(projectService.readProjectState).mockResolvedValue(initialState);
    vi.mocked(projectService.watchProjectState).mockImplementation(
      async (callback) => {
        watchCallback = callback;
        return () => {
          /* no-op */
        };
      }
    );

    const { result } = renderHook(() => useLinkedProject());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data?.status).toBe('unlinked');

    // Simulate file change
    await act(async () => {
      if (watchCallback) {
        watchCallback(updatedState);
      }
    });

    expect(result.current.data?.status).toBe('linked');
    expect(result.current.data?.project?.name).toBe('test-project');
  });

  it('should provide refetch function', async () => {
    const mockState: ProjectDisplayInfo = {
      project: null,
      status: 'unlinked',
      lastSyncTime: Date.now(),
    };

    vi.mocked(projectService.readProjectState).mockResolvedValue(mockState);
    vi.mocked(projectService.watchProjectState).mockResolvedValue(() => {
      /* no-op */
    });

    const { result } = renderHook(() => useLinkedProject());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.refetch();
    });

    expect(projectService.readProjectState).toHaveBeenCalledTimes(2); // Once on mount, once on refetch
  });

  it('should clean up watchers on unmount', async () => {
    const mockState: ProjectDisplayInfo = {
      project: null,
      status: 'unlinked',
      lastSyncTime: Date.now(),
    };

    vi.mocked(projectService.readProjectState).mockResolvedValue(mockState);
    const mockUnwatch = vi.fn();
    vi.mocked(projectService.watchProjectState).mockResolvedValue(mockUnwatch);

    const { unmount } = renderHook(() => useLinkedProject());

    await waitFor(() => {
      // Wait for mount to complete
    });

    unmount();

    expect(mockUnwatch).toHaveBeenCalled();
  });

  it('should handle all project states', async () => {
    const states: ProjectDisplayInfo[] = [
      {
        project: null,
        status: 'unlinked',
        lastSyncTime: Date.now(),
      },
      {
        project: {
          id: 'test-123',
          name: 'test-project',
          path: '/path/to/project',
          linkedAt: Date.now(),
        },
        status: 'linked',
        lastSyncTime: Date.now(),
      },
      {
        project: {
          id: 'test-123',
          name: 'test-project',
          path: '/path/to/missing',
          linkedAt: Date.now(),
        },
        status: 'missing',
        errorMessage: 'Path not found',
        lastSyncTime: Date.now(),
      },
      {
        project: null,
        status: 'error',
        errorMessage: 'Failed to read state',
        lastSyncTime: Date.now(),
      },
    ];

    let watchCallback: ((state: ProjectDisplayInfo) => void) | null = null;

    vi.mocked(projectService.readProjectState).mockResolvedValue(states[0]);
    vi.mocked(projectService.watchProjectState).mockImplementation(
      async (callback) => {
        watchCallback = callback;
        return () => {
          /* no-op */
        };
      }
    );

    const { result } = renderHook(() => useLinkedProject());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Test each state
    for (const state of states.slice(1)) {
      await act(async () => {
        if (watchCallback) {
          watchCallback(state);
        }
      });

      expect(result.current.data?.status).toBe(state.status);
    }
  });
});
