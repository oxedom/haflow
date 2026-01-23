import { describe, it, expect, beforeEach } from 'vitest';
import { execSync, spawn } from 'child_process';
import { existsSync } from 'fs';
import { readFile, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { getTestDir } from '../setup.js';

const CLI_PATH = join(process.cwd(), 'dist/index.js');

function runCli(args: string[], env: Record<string, string> = {}): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`node ${CLI_PATH} ${args.join(' ')}`, {
      encoding: 'utf8',
      env: { ...process.env, ...env },
      timeout: 5000,
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: execError.stdout || '',
      stderr: execError.stderr || '',
      exitCode: execError.status || 1,
    };
  }
}

describe('CLI commands', () => {
  describe('haflow --help', () => {
    it('shows all available commands', () => {
      const { stdout, exitCode } = runCli(['--help'], { HAFLOW_HOME: getTestDir() });

      expect(exitCode).toBe(0);
      expect(stdout).toContain('init');
      expect(stdout).toContain('link');
      expect(stdout).toContain('start');
      expect(stdout).toContain('status');
    });
  });

  describe('haflow --version', () => {
    it('outputs version number', () => {
      const { stdout, exitCode } = runCli(['--version'], { HAFLOW_HOME: getTestDir() });

      expect(exitCode).toBe(0);
      expect(stdout.trim()).toBe('0.1.0');
    });
  });

  describe('haflow init', () => {
    it('creates ~/.haflow directory', () => {
      const testDir = getTestDir();
      const haflowHome = join(testDir, 'haflow-init-test');

      const { stdout, exitCode } = runCli(['init'], { HAFLOW_HOME: haflowHome });

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Initialized');
      expect(existsSync(haflowHome)).toBe(true);
    });

    it('is idempotent - can run multiple times', () => {
      const testDir = getTestDir();
      const haflowHome = join(testDir, 'haflow-init-idem');

      runCli(['init'], { HAFLOW_HOME: haflowHome });
      const { exitCode } = runCli(['init'], { HAFLOW_HOME: haflowHome });

      expect(exitCode).toBe(0);
    });
  });

  describe('haflow link', () => {
    it('links a valid project', async () => {
      const testDir = getTestDir();
      const haflowHome = join(testDir, 'haflow-link');
      const projectDir = join(testDir, 'fake-project');

      // Create a fake valid project structure
      await mkdir(join(projectDir, 'packages/backend'), { recursive: true });

      const { stdout, exitCode } = runCli(['link', projectDir], { HAFLOW_HOME: haflowHome });

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Linked');
      expect(stdout).toContain(projectDir);

      // Verify config was saved
      const configPath = join(haflowHome, 'config.json');
      expect(existsSync(configPath)).toBe(true);
      const config = JSON.parse(await readFile(configPath, 'utf8'));
      expect(config.linkedProject).toBe(projectDir);
    });



    it('re-linking replaces previous project', async () => {
      const testDir = getTestDir();
      const haflowHome = join(testDir, 'haflow-relink');
      const project1 = join(testDir, 'project1');
      const project2 = join(testDir, 'project2');

      await mkdir(join(project1, 'packages/backend'), { recursive: true });
      await mkdir(join(project2, 'packages/backend'), { recursive: true });

      runCli(['link', project1], { HAFLOW_HOME: haflowHome });
      runCli(['link', project2], { HAFLOW_HOME: haflowHome });

      const configPath = join(haflowHome, 'config.json');
      const config = JSON.parse(await readFile(configPath, 'utf8'));
      expect(config.linkedProject).toBe(project2);
    });
  });

  describe('haflow status', () => {
    it('shows home directory path', () => {
      const testDir = getTestDir();
      const haflowHome = join(testDir, 'haflow-status');

      runCli(['init'], { HAFLOW_HOME: haflowHome });
      const { stdout, exitCode } = runCli(['status'], { HAFLOW_HOME: haflowHome });

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Home:');
      expect(stdout).toContain(haflowHome);
    });

    it('shows (none) when no project linked', () => {
      const testDir = getTestDir();
      const haflowHome = join(testDir, 'haflow-status-none');

      runCli(['init'], { HAFLOW_HOME: haflowHome });
      const { stdout } = runCli(['status'], { HAFLOW_HOME: haflowHome });

      expect(stdout).toContain('(none)');
    });

    it('shows linked project path', async () => {
      const testDir = getTestDir();
      const haflowHome = join(testDir, 'haflow-status-linked');
      const projectDir = join(testDir, 'my-project');

      await mkdir(join(projectDir, 'packages/backend'), { recursive: true });
      runCli(['link', projectDir], { HAFLOW_HOME: haflowHome });

      const { stdout } = runCli(['status'], { HAFLOW_HOME: haflowHome });

      expect(stdout).toContain('Project:');
      expect(stdout).toContain(projectDir);
    });

    it('shows backend and frontend port status', () => {
      const testDir = getTestDir();
      const haflowHome = join(testDir, 'haflow-status-ports');

      const { stdout } = runCli(['status'], { HAFLOW_HOME: haflowHome });

      expect(stdout).toContain('Backend:');
      expect(stdout).toContain('port 4000');
      expect(stdout).toContain('Frontend:');
      expect(stdout).toContain('port 5173');
    });
  });

  describe('haflow start', () => {
    it('errors when no project is linked', () => {
      const testDir = getTestDir();
      const haflowHome = join(testDir, 'haflow-start-nolink');

      runCli(['init'], { HAFLOW_HOME: haflowHome });
      const { stderr, exitCode } = runCli(['start'], { HAFLOW_HOME: haflowHome });

      expect(exitCode).toBe(1);
      expect(stderr).toContain('No project linked');
    });

    it('errors when linked project no longer exists', async () => {
      const testDir = getTestDir();
      const haflowHome = join(testDir, 'haflow-start-missing');

      // Create config pointing to non-existent project
      await mkdir(haflowHome, { recursive: true });
      await writeFile(
        join(haflowHome, 'config.json'),
        JSON.stringify({ linkedProject: '/nonexistent/path' })
      );

      const { stderr, exitCode } = runCli(['start'], { HAFLOW_HOME: haflowHome });

      expect(exitCode).toBe(1);
      expect(stderr).toContain('No project linked');
    });
  });
});
