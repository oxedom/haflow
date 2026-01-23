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

  describe('haflowHome', () => {
    it('defaults to ~/.haflow when HAFLOW_HOME env not set', async () => {
      delete process.env.HAFLOW_HOME;
      const { config } = await import('../../../src/utils/config.js');
      expect(config.haflowHome).toBe(join(homedir(), '.haflow'));
    });

    it('respects HAFLOW_HOME env variable', async () => {
      process.env.HAFLOW_HOME = '/custom/path';
      const { config } = await import('../../../src/utils/config.js');
      expect(config.haflowHome).toBe('/custom/path');
    });
  });

  describe('missionsDir', () => {
    it('is haflowHome/missions', async () => {
      process.env.HAFLOW_HOME = '/test/home';
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
