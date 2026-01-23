import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { getTestDir } from '../setup.js';

describe('config module', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('paths', () => {
    it('uses HAFLOW_HOME env variable for home path', async () => {
      const { paths } = await import('../../src/config.js');
      expect(paths.home).toBe(getTestDir());
    });

    it('config path is inside home directory', async () => {
      const { paths } = await import('../../src/config.js');
      expect(paths.config).toBe(join(getTestDir(), 'config.json'));
    });
  });

  describe('ensureHome', () => {
    it('creates home directory if it does not exist', async () => {
      const { ensureHome, paths } = await import('../../src/config.js');

      // Test dir exists but let's test with a subdirectory
      const subDir = join(getTestDir(), 'subdir');
      vi.stubEnv('HAFLOW_HOME', subDir);
      vi.resetModules();

      const { ensureHome: ensureHome2, paths: paths2 } = await import('../../src/config.js');
      expect(existsSync(paths2.home)).toBe(false);

      await ensureHome2();
      expect(existsSync(paths2.home)).toBe(true);
    });

    it('does not error if home directory already exists', async () => {
      const { ensureHome, paths } = await import('../../src/config.js');

      // First call creates it
      await ensureHome();
      expect(existsSync(paths.home)).toBe(true);

      // Second call should not error
      await expect(ensureHome()).resolves.not.toThrow();
    });
  });

  describe('loadConfig', () => {
    it('returns empty object when config file does not exist', async () => {
      const { loadConfig } = await import('../../src/config.js');
      const config = await loadConfig();
      expect(config).toEqual({});
    });

    it('returns parsed config when file exists', async () => {
      const { saveConfig, loadConfig } = await import('../../src/config.js');

      await saveConfig({ linkedProject: '/test/project' });
      const config = await loadConfig();

      expect(config).toEqual({ linkedProject: '/test/project' });
    });
  });

  describe('saveConfig', () => {
    it('creates home directory and saves config', async () => {
      const { saveConfig, paths } = await import('../../src/config.js');

      await saveConfig({ linkedProject: '/my/project' });

      expect(existsSync(paths.config)).toBe(true);
      const content = await readFile(paths.config, 'utf8');
      expect(JSON.parse(content)).toEqual({ linkedProject: '/my/project' });
    });

    it('overwrites existing config', async () => {
      const { saveConfig, loadConfig } = await import('../../src/config.js');

      await saveConfig({ linkedProject: '/first/project' });
      await saveConfig({ linkedProject: '/second/project' });

      const config = await loadConfig();
      expect(config.linkedProject).toBe('/second/project');
    });

    it('formats config as pretty JSON', async () => {
      const { saveConfig, paths } = await import('../../src/config.js');

      await saveConfig({ linkedProject: '/test' });

      const content = await readFile(paths.config, 'utf8');
      expect(content).toContain('\n'); // Pretty printed has newlines
      expect(content).toContain('  '); // Pretty printed has indentation
    });
  });
});
