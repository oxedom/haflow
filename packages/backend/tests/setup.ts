import { beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'haloop-test-'));
  vi.stubEnv('HALOOP_HOME', testDir);
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
