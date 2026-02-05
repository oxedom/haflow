/**
 * Link command - Associates a project with the CLI for synchronization to frontend
 */

import { existsSync, statSync } from 'fs';
import { resolve, basename } from 'path';
import { createHash } from 'crypto';
import type { LinkedProject } from '@haflow/shared';
import { ProjectStateManager } from '../projectStateManager.js';

/**
 * Generate a unique ID for a project based on its path
 * @param path - Absolute path to the project
 * @returns Hash-based ID
 */
function generateProjectId(path: string): string {
  return createHash('sha256').update(path).digest('hex').substring(0, 12);
}

/**
 * Validate that a path exists and is a directory
 * @param path - Path to validate
 * @throws Error if path doesn't exist or isn't a directory
 */
function validateProjectPath(path: string): void {
  if (!existsSync(path)) {
    throw new Error(`Project directory not found: ${path}`);
  }

  try {
    const stats = statSync(path);
    if (!stats.isDirectory()) {
      throw new Error(`Path is not a directory: ${path}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('is not a directory')) {
      throw error;
    }
    throw new Error(`Cannot access path: ${path}`);
  }
}

/**
 * Link a project to haflow
 * @param path - Project directory path (absolute or relative)
 */
export async function linkCommand(path?: string): Promise<void> {
  try {
    const projectPath = resolve(path || process.cwd());
    validateProjectPath(projectPath);

    const stateManager = new ProjectStateManager();

    const linkedProject: LinkedProject = {
      id: generateProjectId(projectPath),
      name: basename(projectPath),
      path: projectPath,
      linkedAt: Date.now(),
    };

    await stateManager.setLinkedProject(linkedProject);

    const stateFilePath = stateManager.getStateFilePath();
    const linkedTime = new Date(linkedProject.linkedAt).toLocaleString();

    console.log('\n✓ Project linked successfully\n');
    console.log(`  Name: ${linkedProject.name}`);
    console.log(`  Path: ${projectPath}`);
    console.log(`  ID:   ${linkedProject.id}`);
    console.log(`  Linked at: ${linkedTime}`);
    console.log(`  State file: ${stateFilePath}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n✗ Error linking project: ${message}\n`);
    process.exit(1);
  }
}
