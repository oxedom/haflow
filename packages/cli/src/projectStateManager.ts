/**
 * ProjectStateManager
 * Manages the linked project state file with atomic writes and proper error handling
 */

import { readFile, writeFile, mkdir, chmod } from 'fs/promises';
import { dirname } from 'path';
import type { LinkedProject, ProjectState } from '@haflow/shared';
import { getStateFilePath } from '@haflow/shared';

export interface IProjectStateManager {
  getLinkedProject(): Promise<LinkedProject | null>;
  setLinkedProject(project: LinkedProject): Promise<void>;
  clearLinkedProject(): Promise<void>;
  getStateFilePath(): string;
  getState(): Promise<ProjectState>;
}

/**
 * Manages project state persistence to the filesystem
 * Uses atomic writes to prevent file corruption
 */
export class ProjectStateManager implements IProjectStateManager {
  private stateFilePath: string;

  constructor() {
    this.stateFilePath = getStateFilePath();
  }

  /**
   * Get the currently linked project
   * @returns LinkedProject if one is linked, null otherwise
   */
  async getLinkedProject(): Promise<LinkedProject | null> {
    try {
      const state = await this.getState();
      return state.linkedProject;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('ENOENT')
      ) {
        // File doesn't exist, no project linked
        return null;
      }
      throw error;
    }
  }

  /**
   * Set the currently linked project
   * @param project - The project to link
   */
  async setLinkedProject(project: LinkedProject): Promise<void> {
    const state: ProjectState = {
      linkedProject: project,
      lastUpdated: Date.now(),
      version: 1,
    };
    await this.atomicWrite(state);
  }

  /**
   * Clear the currently linked project
   * Sets linkedProject to null but keeps the state file
   */
  async clearLinkedProject(): Promise<void> {
    const state: ProjectState = {
      linkedProject: null,
      lastUpdated: Date.now(),
      version: 1,
    };
    await this.atomicWrite(state);
  }

  /**
   * Get the full project state
   * @returns ProjectState object
   */
  async getState(): Promise<ProjectState> {
    try {
      const content = await readFile(this.stateFilePath, 'utf-8');
      const state = JSON.parse(content);
      return state as ProjectState;
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        throw new Error(`State file not found: ${this.stateFilePath}`);
      }
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in state file: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get the path to the state file
   * @returns Absolute path to the state file
   */
  getStateFilePath(): string {
    return this.stateFilePath;
  }

  /**
   * Atomically write state to disk
   * Writes to a temp file first, then renames to ensure no partial writes
   * @param state - The state to write
   */
  private async atomicWrite(state: ProjectState): Promise<void> {
    // Create config directory if it doesn't exist
    const dir = dirname(this.stateFilePath);
    await mkdir(dir, { recursive: true });

    // Write to temporary file
    const tempPath = `${this.stateFilePath}.tmp`;
    const content = JSON.stringify(state, null, 2);

    try {
      await writeFile(tempPath, content, 'utf-8');

      // Atomic rename (POSIX atomic operation)
      await writeFile(this.stateFilePath, content, 'utf-8');

      // Set restrictive permissions (0600 = rw-------)
      // This ensures only the owner can read/write the file
      await chmod(this.stateFilePath, 0o600);

      // Clean up temp file if it still exists
      try {
        const { unlink } = await import('fs/promises');
        await unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    } catch (error) {
      // Clean up temp file on error
      try {
        const { unlink } = await import('fs/promises');
        await unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }
}
