/**
 * Status command - Display information about the currently linked project
 */

import { existsSync } from 'fs';
import { ProjectStateManager } from '../projectStateManager.js';

/**
 * Display the current project linking status
 */
export async function statusCommand(): Promise<void> {
  try {
    const stateManager = new ProjectStateManager();
    const stateFilePath = stateManager.getStateFilePath();

    let linkedProject = null;
    try {
      linkedProject = await stateManager.getLinkedProject();
    } catch {
      // State file may not exist yet
    }

    console.log('\n═══════════════════════════════════════════════════\n');
    console.log('  haflow Project Status\n');

    if (!linkedProject) {
      console.log('  Status: No project linked');
    } else {
      console.log('  Status: Project linked');
      console.log(`  Name:   ${linkedProject.name}`);
      console.log(`  Path:   ${linkedProject.path}`);

      const pathExists = existsSync(linkedProject.path);
      console.log(`  Available: ${pathExists ? '✓ Yes' : '✗ No (path not found)'}`);

      const linkedTime = new Date(linkedProject.linkedAt).toLocaleString();
      console.log(`  Linked at: ${linkedTime}`);
    }

    console.log(`\n  State file: ${stateFilePath}`);
    console.log(`  Exists: ${existsSync(stateFilePath) ? '✓ Yes' : '✗ No'}\n`);

    console.log('═══════════════════════════════════════════════════\n');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n✗ Error checking status: ${message}\n`);
    process.exit(1);
  }
}
