/**
 * Project state types for CLI and Frontend synchronization
 * These types represent the linked project state shared between CLI and Frontend
 */

/**
 * Represents a project linked in the CLI
 */
export interface LinkedProject {
  /** Unique identifier (hash of path) */
  id: string;
  /** Display name (basename of path) */
  name: string;
  /** Absolute filesystem path */
  path: string;
  /** Unix timestamp in milliseconds when the project was linked */
  linkedAt: number;
  /** Optional workspace reference */
  workspaceId?: string;
}

/**
 * Complete state file structure
 * This is the single source of truth persisted to disk
 */
export interface ProjectState {
  /** The currently linked project, or null if no project is linked */
  linkedProject: LinkedProject | null;
  /** Unix timestamp in milliseconds of the last state change */
  lastUpdated: number;
  /** Schema version for forward/backward compatibility */
  version: number;
}

/**
 * Frontend-friendly representation of project state
 * Adds derived information for UI consumption
 */
export interface ProjectDisplayInfo {
  /** The linked project data, or null if unlinked */
  project: LinkedProject | null;
  /** Current status of the project display */
  status: 'linked' | 'missing' | 'error' | 'unlinked';
  /** Optional error message if status is 'error' */
  errorMessage?: string;
  /** Unix timestamp in milliseconds when the state was last synchronized */
  lastSyncTime: number;
}
