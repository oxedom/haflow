import { mkdtempSync, existsSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Use a predictable base path for the test directory
// This allows both config and setup/teardown to know the path
const E2E_TEST_BASE = join(tmpdir(), 'haloop-e2e');

// Ensure base directory exists
if (!existsSync(E2E_TEST_BASE)) {
  mkdirSync(E2E_TEST_BASE, { recursive: true });
}

// Create unique test directory for this run
// In CI, use a fixed path; locally, create a unique one per run
export const TEST_DIR = process.env.CI
  ? join(E2E_TEST_BASE, 'ci-run')
  : mkdtempSync(join(E2E_TEST_BASE, 'run-'));

// Export env vars for webServer processes
export const E2E_ENV = {
  HALOOP_HOME: TEST_DIR,
  NODE_ENV: 'test',
};
