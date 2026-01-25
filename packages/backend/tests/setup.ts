import { beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Use project-local .test-tmp directory to avoid Docker Desktop file sharing issues
// Docker Desktop (on macOS/Windows/Linux) restricts which host paths can be mounted
const projectTmpDir = join(__dirname, '..', '.test-tmp');

let testDir: string;

beforeEach(async () => {
  // Ensure the project-local temp directory exists
  await mkdir(projectTmpDir, { recursive: true });
  testDir = await mkdtemp(join(projectTmpDir, 'haflow-test-'));
  vi.stubEnv('HAFLOW_HOME', testDir);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  if (testDir) {
    await rm(testDir, { recursive: true, force: true });
  }
});

export function getTestDir(): string {
  return testDir;
}
