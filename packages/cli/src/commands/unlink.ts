/**
 * Unlink command - Removes the currently linked project
 */

import { ProjectStateManager } from '../projectStateManager.js';

/**
 * Unlink the currently linked project
 */
export async function unlinkCommand(): Promise<void> {
  try {
    const stateManager = new ProjectStateManager();

    // Get the current project first to show what we're unlinking
    const linkedProject = await stateManager.getLinkedProject();

    if (!linkedProject) {
      console.log('\n  No project currently linked\n');
      return;
    }

    // Clear the linked project
    await stateManager.clearLinkedProject();

    console.log('\n✓ Project unlinked successfully\n');
    console.log(`  Unlinked: ${linkedProject.name}`);
    console.log(`  Path: ${linkedProject.path}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n✗ Error unlinking project: ${message}\n`);
    process.exit(1);
  }
}
