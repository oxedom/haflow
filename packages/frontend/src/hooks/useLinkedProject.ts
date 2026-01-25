/**
 * useLinkedProject Hook
 * Manages reading and watching the linked project state from the filesystem
 * Provides real-time updates when CLI changes the linked project
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  readProjectState,
  watchProjectState,
} from '../services/projectService.js';
import type { ProjectDisplayInfo } from '@haflow/shared';

interface UseLinkedProjectState {
  data: ProjectDisplayInfo | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to read and watch the linked project state
 * @returns Current project state, loading status, error, and refetch function
 */
export function useLinkedProject(): UseLinkedProjectState {
  const [state, setState] = useState<ProjectDisplayInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const unwatchRef = useRef<(() => void) | null>(null);

  // Fetch current state
  const fetchState = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await readProjectState();
      setState(data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Set up file watcher on mount
  useEffect(() => {
    let mounted = true;

    (async () => {
      // Initial fetch
      await fetchState();

      if (!mounted) return;

      // Set up file watcher
      try {
        const unwatch = await watchProjectState((newState) => {
          if (mounted) {
            setState(newState);
          }
        });

        unwatchRef.current = unwatch;
      } catch (err) {
        if (mounted) {
          const error = err instanceof Error ? err : new Error(String(err));
          setError(error);
        }
      }
    })();

    // Cleanup on unmount
    return () => {
      mounted = false;
      if (unwatchRef.current) {
        unwatchRef.current();
        unwatchRef.current = null;
      }
    };
  }, [fetchState]);

  const refetch = useCallback(async () => {
    await fetchState();
  }, [fetchState]);

  return {
    data: state,
    isLoading,
    error,
    refetch,
  };
}
