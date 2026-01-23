import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { homedir } from 'os';
import { join } from 'path';

describe('config utils', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('port', () => {
    it('defaults to 4000 when PORT env not set', async () => {
      delete process.env.PORT;
      const { config } = await import('../../../src/utils/config.js');
      expect(config.port).toBe(4000);
    });

    it('respects PORT env variable', async () => {
      process.env.PORT = '5000';
      const { config } = await import('../../../src/utils/config.js');
      expect(config.port).toBe(5000);
    });
  });

  describe('haloopHome', () => {
    it('defaults to ~/.haloop when HALOOP_HOME env not set', async () => {
      delete process.env.HALOOP_HOME;
      const { config } = await import('../../../src/utils/config.js');
      expect(config.haloopHome).toBe(join(homedir(), '.haloop'));
    });

    it('respects HALOOP_HOME env variable', async () => {
      process.env.HALOOP_HOME = '/custom/path';
      const { config } = await import('../../../src/utils/config.js');
      expect(config.haloopHome).toBe('/custom/path');
    });
  });

  describe('missionsDir', () => {
    it('is haloopHome/missions', async () => {
      process.env.HALOOP_HOME = '/test/home';
      const { config } = await import('../../../src/utils/config.js');
      expect(config.missionsDir).toBe('/test/home/missions');
    });
  });

  describe('workflowsDir', () => {
    it('is cwd/packages/backend/public/workflows', async () => {
      const { config } = await import('../../../src/utils/config.js');
      expect(config.workflowsDir).toBe(
        join(process.cwd(), 'packages/backend/public/workflows')
      );
    });
  });
});
