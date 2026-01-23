import type { FullConfig } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import { rm } from 'fs/promises';
import { TEST_DIR } from './e2e-env';

const execAsync = promisify(exec);

export default async function globalTeardown(_config: FullConfig) {
  // Cleanup test directory
  try {
    await rm(TEST_DIR, { recursive: true, force: true });
    console.log(`Cleaned up test directory: ${TEST_DIR}`);
  } catch {
    // Directory may already be cleaned up
  }

  // Cleanup any orphaned Docker containers from tests
  try {
    const { stdout } = await execAsync(
      'docker ps -aq --filter="label=haloop.mission_id"'
    );
    const containerIds = stdout.trim().split('\n').filter(Boolean);
    for (const id of containerIds) {
      await execAsync(`docker rm -f ${id}`).catch(() => {});
    }
    if (containerIds.length > 0) {
      console.log(`Cleaned up ${containerIds.length} orphaned containers`);
    }
  } catch {
    // Docker not available or no containers to clean
  }

  console.log('E2E test teardown complete');
}
