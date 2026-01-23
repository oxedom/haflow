import type { FullConfig } from '@playwright/test';
import { mkdir, rm } from 'fs/promises';
import { TEST_DIR, E2E_ENV } from './e2e-env';

export default async function globalSetup(_config: FullConfig) {
  // Clean and recreate the test directory
  await rm(TEST_DIR, { recursive: true, force: true });
  await mkdir(TEST_DIR, { recursive: true });

  // Set env vars for any child processes
  Object.assign(process.env, E2E_ENV);

  console.log(`E2E test setup complete. HAFLOW_HOME=${TEST_DIR}`);
}
