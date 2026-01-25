import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import { resolve } from 'path';
import { dockerProvider } from '../../../src/services/docker.js';

const execAsync = promisify(exec);

describe('frontend container runtime', () => {
  let dockerAvailable: boolean;
  let containerId: string | null = null;
  const CONTAINER_NAME = 'frontend-runtime-integration-test';
  const HOST_PORT = 4173;
  const skipInCi = Boolean(process.env.CI);

  beforeAll(async () => {
    dockerAvailable = await dockerProvider.isAvailable();
    if (!dockerAvailable) {
      console.warn('Docker not available - skipping frontend runtime tests');
    }
  });

  afterAll(async () => {
    // Cleanup container if it exists
    if (containerId || dockerAvailable) {
      try {
        await execAsync(`docker rm -f ${CONTAINER_NAME}`);
      } catch {
        // Container may not exist
      }
    }
  });

  it.skipIf(skipInCi)('builds and serves the Vue fixture via preview', async () => {
    if (!dockerAvailable) return;

    const fixturePath = resolve(__dirname, '../../resource/vue-frontend');

    // Build on host first (much faster than building inside Docker)
    // Use --ignore-workspace to install deps locally in the fixture directory
    await execAsync('pnpm install --ignore-workspace && pnpm run build', { cwd: fixturePath });

    // Start container serving pre-built dist folder
    const { stdout } = await execAsync(
      `docker run -d --name ${CONTAINER_NAME} ` +
      `-p ${HOST_PORT}:4173 ` +
      `-v "${fixturePath}/dist:/app" ` +
      `-w /app ` +
      `node:20-slim ` +
      `sh -c "npx -y serve -l 4173"`
    );
    containerId = stdout.trim();

    // Poll for the server to be ready (max 30 seconds)
    const maxAttempts = 15;
    let serverReady = false;

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`http://localhost:${HOST_PORT}/`);
        if (response.ok) {
          const html = await response.text();
          expect(html).toContain('<!doctype html>');
          expect(html).toContain('<div id="app">');
          serverReady = true;
          break;
        }
      } catch {
        // Server not ready yet
      }

      // Check if container is still running
      try {
        const { stdout: status } = await execAsync(
          `docker inspect --format='{{.State.Status}}' ${CONTAINER_NAME}`
        );
        if (status.trim() === 'exited') {
          const { stdout: logs } = await execAsync(`docker logs ${CONTAINER_NAME} 2>&1`);
          throw new Error(`Container exited unexpectedly. Logs:\n${logs}`);
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes('Container exited')) {
          throw e;
        }
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    expect(serverReady).toBe(true);
  }, 90000); // 90s timeout - npm install + build on host, serve in container
});
