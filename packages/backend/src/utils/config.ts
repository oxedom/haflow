import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __dirname = dirname(fileURLToPath(import.meta.url));
// Navigate from packages/backend/src/utils/ up to repo root
const repoRoot = join(__dirname, '..', '..', '..', '..');

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  haflowHome: process.env.HAFLOW_HOME || join(homedir(), '.haflow'),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  // Path to the haflow repo's .claude folder
  haflowClaudeDir: join(repoRoot, '.claude'),
  get missionsDir() {
    return join(this.haflowHome, 'missions');
  },
  // Workflows live with the backend for v0
  get workflowsDir() {
    return join(process.cwd(), 'packages/backend/public/workflows');
  },
};

// CLI config structure
interface CliConfig {
  linkedProject?: string;
}

/**
 * Read linked project path from CLI config (~/.haflow/config.json)
 */
export async function getLinkedProject(): Promise<string | undefined> {
  const configPath = join(config.haflowHome, 'config.json');

  if (!existsSync(configPath)) {
    return undefined;
  }

  try {
    const content = await readFile(configPath, 'utf8');
    const cliConfig: CliConfig = JSON.parse(content);
    return cliConfig.linkedProject;
  } catch {
    return undefined;
  }
}

/**
 * Check git status - returns clean:true if no uncommitted changes
 */
export async function checkGitStatus(
  projectPath: string
): Promise<{ clean: boolean; error?: string }> {
  try {
    const { stdout } = await execAsync('git status --porcelain', {
      cwd: projectPath,
    });

    if (stdout.trim()) {
      return {
        clean: false,
        error: `Linked project has uncommitted changes. Please commit or stash before running codegen steps.`,
      };
    }

    return { clean: true };
  } catch (err) {
    return {
      clean: false,
      error: `Failed to check git status: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
}

/**
 * Clone project to mission directory (fresh start - removes existing clone)
 * Uses git clone --local for fast local cloning (hard links objects)
 */
export async function cloneProjectToMission(
  missionId: string,
  sourcePath: string
): Promise<string> {
  const clonePath = join(config.missionsDir, missionId, 'project');

  // Remove existing clone if present (fresh start)
  if (existsSync(clonePath)) {
    await rm(clonePath, { recursive: true, force: true });
  }

  // Clone using --local for speed (uses hard links for .git objects)
  // This preserves full git history for proper diff/status
  await execAsync(`git clone --local "${sourcePath}" "${clonePath}"`);

  return clonePath;
}

/**
 * Get git diff summary for a project (for UI display)
 */
export async function getGitDiff(
  projectPath: string
): Promise<{ files: string[]; summary: string }> {
  try {
    // Get list of changed files (staged + unstaged)
    const { stdout: filesOutput } = await execAsync(
      'git diff --name-only HEAD',
      { cwd: projectPath }
    );
    const files = filesOutput.trim().split('\n').filter(Boolean);

    // Get diff stat summary
    const { stdout: statOutput } = await execAsync('git diff --stat HEAD', {
      cwd: projectPath,
    });

    return {
      files,
      summary: statOutput.trim(),
    };
  } catch {
    return { files: [], summary: '' };
  }
}

/**
 * Get full git diff for a specific file (for UI display)
 */
export async function getFileDiff(
  projectPath: string,
  filePath: string
): Promise<string> {
  try {
    const { stdout } = await execAsync(`git diff HEAD -- "${filePath}"`, {
      cwd: projectPath,
    });
    return stdout;
  } catch {
    return '';
  }
}

/**
 * Get git status for a cloned project (for API endpoint)
 */
export async function getProjectGitStatus(missionId: string): Promise<{
  hasChanges: boolean;
  files: Array<{ path: string; status: string }>;
  summary: string;
}> {
  const clonePath = join(config.missionsDir, missionId, 'project');

  if (!existsSync(clonePath)) {
    return { hasChanges: false, files: [], summary: '' };
  }

  try {
    // Get porcelain status for parsing
    const { stdout: statusOutput } = await execAsync('git status --porcelain', {
      cwd: clonePath,
    });

    const files = statusOutput
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => ({
        status: line.slice(0, 2).trim(),
        path: line.slice(3),
      }));

    // Get diff stat for summary
    const { stdout: statOutput } = await execAsync('git diff --stat HEAD', {
      cwd: clonePath,
    });

    return {
      hasChanges: files.length > 0,
      files,
      summary: statOutput.trim(),
    };
  } catch {
    return { hasChanges: false, files: [], summary: '' };
  }
}
