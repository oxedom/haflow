import { beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'haflow-cli-test-'));
  vi.stubEnv('HAFLOW_HOME', testDir);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.resetModules();
  if (testDir) {
    await rm(testDir, { recursive: true, force: true });
  }
});

export function getTestDir(): string {
  return testDir;
}
