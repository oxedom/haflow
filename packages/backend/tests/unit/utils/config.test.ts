import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { homedir } from 'os';
import { join } from 'path';
import { mkdtemp, writeFile, mkdir, rm, appendFile } from 'fs/promises';
import { tmpdir } from 'os';
import { existsSync } from 'fs';

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

describe('git utilities', () => {
  let tempDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    tempDir = await mkdtemp(join(tmpdir(), 'haflow-test-'));
    process.env.HAFLOW_HOME = tempDir;
    vi.resetModules();
  });

  afterEach(async () => {
    process.env = originalEnv;
    if (tempDir && existsSync(tempDir)) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('getLinkedProject', () => {
    it('returns undefined when config file does not exist', async () => {
      const { getLinkedProject } = await import('../../../src/utils/config.js');
      const result = await getLinkedProject();
      expect(result).toBeUndefined();
    });

    it('reads linkedProject from config file', async () => {
      const configPath = join(tempDir, 'config.json');
      await writeFile(configPath, JSON.stringify({ linkedProject: '/path/to/project' }));

      const { getLinkedProject } = await import('../../../src/utils/config.js');
      const result = await getLinkedProject();
      expect(result).toBe('/path/to/project');
    });

    it('returns undefined for malformed JSON', async () => {
      const configPath = join(tempDir, 'config.json');
      await writeFile(configPath, 'not valid json');

      const { getLinkedProject } = await import('../../../src/utils/config.js');
      const result = await getLinkedProject();
      expect(result).toBeUndefined();
    });

    it('returns undefined when linkedProject field is missing', async () => {
      const configPath = join(tempDir, 'config.json');
      await writeFile(configPath, JSON.stringify({ otherField: 'value' }));

      const { getLinkedProject } = await import('../../../src/utils/config.js');
      const result = await getLinkedProject();
      expect(result).toBeUndefined();
    });
  });

  describe('checkGitStatus', () => {
    let gitDir: string;

    beforeEach(async () => {
      gitDir = await mkdtemp(join(tmpdir(), 'git-test-'));
      // Initialize a git repo
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      await execAsync('git init', { cwd: gitDir });
      await execAsync('git config user.email "test@test.com"', { cwd: gitDir });
      await execAsync('git config user.name "Test"', { cwd: gitDir });
      // Create initial commit
      await writeFile(join(gitDir, 'README.md'), '# Test');
      await execAsync('git add .', { cwd: gitDir });
      await execAsync('git commit -m "Initial commit"', { cwd: gitDir });
    });

    afterEach(async () => {
      if (gitDir && existsSync(gitDir)) {
        await rm(gitDir, { recursive: true, force: true });
      }
    });

    it('returns clean:true for clean repo', async () => {
      const { checkGitStatus } = await import('../../../src/utils/config.js');
      const result = await checkGitStatus(gitDir);
      expect(result.clean).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns clean:false for dirty repo', async () => {
      // Make uncommitted change
      await appendFile(join(gitDir, 'README.md'), '\nNew content');

      const { checkGitStatus } = await import('../../../src/utils/config.js');
      const result = await checkGitStatus(gitDir);
      expect(result.clean).toBe(false);
      expect(result.error).toContain('uncommitted changes');
    });

    it('returns error for non-git directory', async () => {
      const nonGitDir = await mkdtemp(join(tmpdir(), 'nongit-'));
      try {
        const { checkGitStatus } = await import('../../../src/utils/config.js');
        const result = await checkGitStatus(nonGitDir);
        expect(result.clean).toBe(false);
        expect(result.error).toContain('Failed to check git status');
      } finally {
        await rm(nonGitDir, { recursive: true, force: true });
      }
    });
  });

  describe('cloneProjectToMission', () => {
    let sourceGitDir: string;

    beforeEach(async () => {
      // Create a source git repo to clone
      sourceGitDir = await mkdtemp(join(tmpdir(), 'source-git-'));
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      await execAsync('git init', { cwd: sourceGitDir });
      await execAsync('git config user.email "test@test.com"', { cwd: sourceGitDir });
      await execAsync('git config user.name "Test"', { cwd: sourceGitDir });
      await writeFile(join(sourceGitDir, 'src', 'index.ts').replace('/src/', '/'), '// source code');
      await mkdir(join(sourceGitDir, 'src'));
      await writeFile(join(sourceGitDir, 'src', 'index.ts'), '// source code');
      await execAsync('git add .', { cwd: sourceGitDir });
      await execAsync('git commit -m "Initial commit"', { cwd: sourceGitDir });
    });

    afterEach(async () => {
      if (sourceGitDir && existsSync(sourceGitDir)) {
        await rm(sourceGitDir, { recursive: true, force: true });
      }
    });

    it('clones project to mission directory', async () => {
      // Create missions dir
      await mkdir(join(tempDir, 'missions', 'm-test'), { recursive: true });

      const { cloneProjectToMission } = await import('../../../src/utils/config.js');
      const clonePath = await cloneProjectToMission('m-test', sourceGitDir);

      expect(clonePath).toBe(join(tempDir, 'missions', 'm-test', 'project'));
      expect(existsSync(clonePath)).toBe(true);
      expect(existsSync(join(clonePath, '.git'))).toBe(true);
      expect(existsSync(join(clonePath, 'src', 'index.ts'))).toBe(true);
    });

    it('removes existing clone and creates fresh one', async () => {
      // Create missions dir and fake existing clone
      const missionDir = join(tempDir, 'missions', 'm-test');
      const projectDir = join(missionDir, 'project');
      await mkdir(projectDir, { recursive: true });
      await writeFile(join(projectDir, 'old-file.txt'), 'old content');

      const { cloneProjectToMission } = await import('../../../src/utils/config.js');
      const clonePath = await cloneProjectToMission('m-test', sourceGitDir);

      expect(existsSync(join(clonePath, 'old-file.txt'))).toBe(false);
      expect(existsSync(join(clonePath, 'src', 'index.ts'))).toBe(true);
    });
  });

  describe('getProjectGitStatus', () => {
    let sourceGitDir: string;

    beforeEach(async () => {
      sourceGitDir = await mkdtemp(join(tmpdir(), 'source-git-'));
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      await execAsync('git init', { cwd: sourceGitDir });
      await execAsync('git config user.email "test@test.com"', { cwd: sourceGitDir });
      await execAsync('git config user.name "Test"', { cwd: sourceGitDir });
      await mkdir(join(sourceGitDir, 'src'));
      await writeFile(join(sourceGitDir, 'src', 'index.ts'), '// source code');
      await execAsync('git add .', { cwd: sourceGitDir });
      await execAsync('git commit -m "Initial commit"', { cwd: sourceGitDir });
    });

    afterEach(async () => {
      if (sourceGitDir && existsSync(sourceGitDir)) {
        await rm(sourceGitDir, { recursive: true, force: true });
      }
    });

    it('returns hasChanges:false when project dir does not exist', async () => {
      const { getProjectGitStatus } = await import('../../../src/utils/config.js');
      const result = await getProjectGitStatus('m-nonexistent');
      expect(result.hasChanges).toBe(false);
      expect(result.files).toEqual([]);
    });

    it('returns hasChanges:false for clean clone', async () => {
      await mkdir(join(tempDir, 'missions', 'm-test'), { recursive: true });

      const { cloneProjectToMission, getProjectGitStatus } = await import('../../../src/utils/config.js');
      await cloneProjectToMission('m-test', sourceGitDir);

      const result = await getProjectGitStatus('m-test');
      expect(result.hasChanges).toBe(false);
      expect(result.files).toEqual([]);
    });

    it('returns hasChanges:true with modified files', async () => {
      await mkdir(join(tempDir, 'missions', 'm-test'), { recursive: true });

      const { cloneProjectToMission, getProjectGitStatus } = await import('../../../src/utils/config.js');
      const clonePath = await cloneProjectToMission('m-test', sourceGitDir);

      // Modify a file
      await appendFile(join(clonePath, 'src', 'index.ts'), '\n// modified');

      const result = await getProjectGitStatus('m-test');
      expect(result.hasChanges).toBe(true);
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files.some(f => f.path.includes('index.ts'))).toBe(true);
    });
  });
});
