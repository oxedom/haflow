/**
 * ProjectService
 * Frontend service for reading and validating project state file
 * Assumes frontend runs in Node.js/Electron environment with filesystem access
 */

import type {
  LinkedProject,
  ProjectState,
  ProjectDisplayInfo,
} from '@haflow/shared';
import { getStateFilePath } from '@haflow/shared';

/**
 * Read the project state file from disk
 * @returns ProjectDisplayInfo with current state and status
 */
export async function readProjectState(): Promise<ProjectDisplayInfo> {
  const now = Date.now();

  try {
    // Read file using Node.js fs module (available in Electron main/preload)
    const { readFile } = await import('fs/promises');
    const stateFilePath = getStateFilePath();

    try {
      const content = await readFile(stateFilePath, 'utf-8');
      const state = JSON.parse(content) as ProjectState;

      // Validate state structure
      const validation = validateProjectState(state);
      if (!validation.valid) {
        return {
          project: null,
          status: 'error',
          errorMessage: validation.error,
          lastSyncTime: now,
        };
      }

      // Check if project path exists (if a project is linked)
      if (state.linkedProject) {
        const { existsSync } = await import('fs');
        const pathExists = existsSync(state.linkedProject.path);

        if (!pathExists) {
          return {
            project: state.linkedProject,
            status: 'missing',
            errorMessage: `Project path not found: ${state.linkedProject.path}`,
            lastSyncTime: now,
          };
        }

        return {
          project: state.linkedProject,
          status: 'linked',
          lastSyncTime: now,
        };
      }

      return {
        project: null,
        status: 'unlinked',
        lastSyncTime: now,
      };
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        // State file doesn't exist - no project linked yet
        return {
          project: null,
          status: 'unlinked',
          lastSyncTime: now,
        };
      }

      // JSON parse error
      if (error instanceof SyntaxError) {
        return {
          project: null,
          status: 'error',
          errorMessage: `Invalid state file format: ${error.message}`,
          lastSyncTime: now,
        };
      }

      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      project: null,
      status: 'error',
      errorMessage: `Failed to read project state: ${message}`,
      lastSyncTime: now,
    };
  }
}

/**
 * Validate project state structure
 * @param state - State to validate
 * @returns Validation result
 */
function validateProjectState(state: unknown): {
  valid: boolean;
  error?: string;
} {
  if (!state || typeof state !== 'object') {
    return { valid: false, error: 'State is not an object' };
  }

  const s = state as Record<string, unknown>;

  if (typeof s.version !== 'number') {
    return { valid: false, error: 'Missing or invalid version field' };
  }

  if (typeof s.lastUpdated !== 'number') {
    return { valid: false, error: 'Missing or invalid lastUpdated field' };
  }

  if (s.linkedProject !== null && s.linkedProject !== undefined) {
    const validation = validateLinkedProject(s.linkedProject);
    if (!validation.valid) {
      return validation;
    }
  }

  return { valid: true };
}

/**
 * Validate linked project structure
 * @param project - Project to validate
 * @returns Validation result
 */
function validateLinkedProject(project: unknown): {
  valid: boolean;
  error?: string;
} {
  if (!project || typeof project !== 'object') {
    return { valid: false, error: 'linkedProject is not an object' };
  }

  const p = project as Record<string, unknown>;

  if (typeof p.id !== 'string' || !p.id) {
    return { valid: false, error: 'Missing or invalid project id' };
  }

  if (typeof p.name !== 'string' || !p.name) {
    return { valid: false, error: 'Missing or invalid project name' };
  }

  if (typeof p.path !== 'string' || !p.path) {
    return { valid: false, error: 'Missing or invalid project path' };
  }

  if (typeof p.linkedAt !== 'number' || p.linkedAt <= 0) {
    return { valid: false, error: 'Missing or invalid linkedAt timestamp' };
  }

  return { valid: true };
}

/**
 * Get the path to the state file (for debugging/logging)
 * @returns Path to the state file
 */
export function getProjectStateFilePath(): string {
  return getStateFilePath();
}

/**
 * Watch for changes to the project state file
 * Returns an unsubscribe function
 * @param callback - Called when state changes
 * @param debounceMs - Debounce delay in milliseconds
 * @returns Unsubscribe function
 */
export async function watchProjectState(
  callback: (state: ProjectDisplayInfo) => void,
  debounceMs = 100
): Promise<() => void> {
  try {
    // Try to use chokidar if available, otherwise fall back to fs.watch
    const stateFilePath = getStateFilePath();

    let debounceTimer: NodeJS.Timeout | null = null;

    const onChangeHandler = async () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(async () => {
        const state = await readProjectState();
        callback(state);
      }, debounceMs);
    };

    // Try to use chokidar first (if available)
    try {
      const chokidar = await import('chokidar');
      const watcher = chokidar.watch(stateFilePath, {
        persistent: true,
        usePolling: false,
        interval: 100,
        binaryInterval: 300,
      });

      watcher.on('change', onChangeHandler);

      return () => {
        watcher.close();
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
      };
    } catch {
      // Chokidar not available, use fs.watch
      const fs = await import('fs');
      const watcher = fs.watch(
        stateFilePath,
        { persistent: true },
        (eventType) => {
          if (eventType === 'change') {
            onChangeHandler();
          }
        }
      );

      return () => {
        watcher.close();
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
      };
    }
  } catch (error) {
    console.warn('Failed to set up file watcher:', error);
    // Return a no-op unsubscribe function
    return () => {
      /* no-op */
    };
  }
}
