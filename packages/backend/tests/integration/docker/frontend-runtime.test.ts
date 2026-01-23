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

  it('builds and serves the Vue fixture via preview', async () => {
    if (!dockerAvailable) return;

    const fixturePath = resolve(__dirname, '../../resource/vue-frontend');

    // Start container in detached mode
    const { stdout } = await execAsync(
      `docker run -d --name ${CONTAINER_NAME} ` +
      `-p ${HOST_PORT}:4173 ` +
      `-v "${fixturePath}:/app" ` +
      `-w /app ` +
      `node:20-slim ` +
      `sh -c "npm install && npm run build && npm run preview -- --host 0.0.0.0 --port 4173"`
    );
    containerId = stdout.trim();

    // Poll for the preview server to be ready (max 3 minutes)
    const maxAttempts = 90;
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

    // Verify container logs show successful build
    const { stdout: logs } = await execAsync(`docker logs ${CONTAINER_NAME} 2>&1`);
    expect(logs).toContain('built in');
    expect(logs).toMatch(/Local:\s+http:\/\/localhost:4173/);
  }, 180000); // 3 minute timeout for npm install + build
});
