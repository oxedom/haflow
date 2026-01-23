import type { FullConfig } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);

export default async function globalSetup(config: FullConfig) {
  // Set test environment
  process.env.NODE_ENV = 'test';

  // Create isolated test directory for HALOOP_HOME
  const testDir = await mkdtemp(join(tmpdir(), 'haloop-e2e-'));
  process.env.HALOOP_HOME = testDir;

  // Store test dir for teardown
  (globalThis as any).__E2E_TEST_DIR__ = testDir;

  console.log(`E2E test setup complete. HALOOP_HOME=${testDir}`);
}
