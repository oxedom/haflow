import { spawn } from 'child_process';
import * as path from 'path';
import { sanitizeBranchName } from '../utils/sanitize';

/**
 * Result of a git command execution
 */
export interface GitResult {
  stdout: string;
  stderr: string;
  code: number;
}

/**
 * Options for creating a worktree
 */
export interface CreateWorktreeOptions {
  projectPath: string;
  missionName: string;
  missionId: string;
}

/**
 * Result of creating a worktree
 */
export interface WorktreeResult {
  worktreePath: string;
  branchName: string;
}

/**
 * Execute a git command and return the result
 */
function execGit(args: string[], cwd: string): Promise<GitResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('error', (err: Error) => {
      reject(err);
    });

    child.on('close', (code: number | null) => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        code: code ?? 1,
      });
    });
  });
}

/**
 * GitManager class for managing git operations on project repositories.
 * Handles worktree creation, branch management, commits, and pushes.
 */
export class GitManager {
  /**
   * Create a git worktree for a mission.
   * The worktree is created at <project>/.ralphy/missions/<missionId>/worktree
   * with a new branch named ralphy/feature/<sanitized-mission-name>
   *
   * @param opts - Options including projectPath, missionName, and missionId
   * @returns The worktree path and branch name
   */
  async createWorktree(opts: CreateWorktreeOptions): Promise<WorktreeResult> {
    const { projectPath, missionName, missionId } = opts;

    // Sanitize mission name for branch naming
    const sanitizedName = sanitizeBranchName(missionName);
    const branchName = `ralphy/feature/${sanitizedName}`;

    // Worktree path: <project>/.ralphy/missions/<missionId>/worktree
    const worktreePath = path.join(
      projectPath,
      '.ralphy',
      'missions',
      missionId,
      'worktree'
    );

    // Run: git worktree add <path> -b <branch>
    const result = await execGit(
      ['worktree', 'add', worktreePath, '-b', branchName],
      projectPath
    );

    if (result.code !== 0) {
      throw new Error(`Failed to create worktree: ${result.stderr || result.stdout}`);
    }

    return {
      worktreePath,
      branchName,
    };
  }

  /**
   * Create a new branch in a worktree.
   * Useful for creating feature branches from an existing worktree.
   *
   * @param worktreePath - Path to the worktree
   * @param branchName - Name of the new branch
   */
  async createBranch(worktreePath: string, branchName: string): Promise<void> {
    const result = await execGit(['checkout', '-b', branchName], worktreePath);

    if (result.code !== 0) {
      throw new Error(`Failed to create branch: ${result.stderr || result.stdout}`);
    }
  }

  /**
   * Stage all changes and create a commit.
   * Runs: git add . && git commit -m '<message>'
   *
   * @param worktreePath - Path to the worktree
   * @param message - Commit message
   */
  async commit(worktreePath: string, message: string): Promise<void> {
    // First, stage all changes
    const addResult = await execGit(['add', '.'], worktreePath);

    if (addResult.code !== 0) {
      throw new Error(`Failed to stage changes: ${addResult.stderr || addResult.stdout}`);
    }

    // Then commit
    const commitResult = await execGit(['commit', '-m', message], worktreePath);

    // Code 1 with "nothing to commit" is not an error
    if (commitResult.code !== 0) {
      const output = commitResult.stdout + commitResult.stderr;
      if (!output.includes('nothing to commit')) {
        throw new Error(`Failed to commit: ${commitResult.stderr || commitResult.stdout}`);
      }
    }
  }

  /**
   * Push the current branch to origin with upstream tracking.
   * Runs: git push -u origin <branch>
   *
   * @param worktreePath - Path to the worktree
   */
  async push(worktreePath: string): Promise<void> {
    // Get current branch name
    const branchResult = await execGit(['rev-parse', '--abbrev-ref', 'HEAD'], worktreePath);

    if (branchResult.code !== 0) {
      throw new Error(`Failed to get current branch: ${branchResult.stderr || branchResult.stdout}`);
    }

    const branchName = branchResult.stdout;

    // Push with upstream tracking
    const pushResult = await execGit(['push', '-u', 'origin', branchName], worktreePath);

    if (pushResult.code !== 0) {
      throw new Error(`Failed to push: ${pushResult.stderr || pushResult.stdout}`);
    }
  }

  /**
   * Get the current branch name in a worktree.
   *
   * @param worktreePath - Path to the worktree
   * @returns The current branch name
   */
  async getCurrentBranch(worktreePath: string): Promise<string> {
    const result = await execGit(['rev-parse', '--abbrev-ref', 'HEAD'], worktreePath);

    if (result.code !== 0) {
      throw new Error(`Failed to get current branch: ${result.stderr || result.stdout}`);
    }

    return result.stdout;
  }

  /**
   * Remove a worktree.
   *
   * @param projectPath - Path to the main project
   * @param worktreePath - Path to the worktree to remove
   */
  async removeWorktree(projectPath: string, worktreePath: string): Promise<void> {
    const result = await execGit(['worktree', 'remove', worktreePath, '--force'], projectPath);

    if (result.code !== 0) {
      throw new Error(`Failed to remove worktree: ${result.stderr || result.stdout}`);
    }
  }

  /**
   * List all worktrees in a project.
   *
   * @param projectPath - Path to the main project
   * @returns Array of worktree paths
   */
  async listWorktrees(projectPath: string): Promise<string[]> {
    const result = await execGit(['worktree', 'list', '--porcelain'], projectPath);

    if (result.code !== 0) {
      throw new Error(`Failed to list worktrees: ${result.stderr || result.stdout}`);
    }

    // Parse the porcelain output
    const worktrees: string[] = [];
    const lines = result.stdout.split('\n');
    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        worktrees.push(line.substring('worktree '.length));
      }
    }

    return worktrees;
  }

  /**
   * Check if a repository has uncommitted changes.
   *
   * @param repoPath - Path to the repository
   * @returns True if there are uncommitted changes
   */
  async hasUncommittedChanges(repoPath: string): Promise<boolean> {
    const result = await execGit(['status', '--porcelain'], repoPath);

    if (result.code !== 0) {
      throw new Error(`Failed to check git status: ${result.stderr || result.stdout}`);
    }

    return result.stdout.length > 0;
  }

  /**
   * Check if a branch exists locally.
   *
   * @param repoPath - Path to the repository
   * @param branchName - Name of the branch to check
   * @returns True if the branch exists
   */
  async branchExists(repoPath: string, branchName: string): Promise<boolean> {
    const result = await execGit(
      ['show-ref', '--verify', '--quiet', `refs/heads/${branchName}`],
      repoPath
    );

    return result.code === 0;
  }
}

// Singleton instance
let gitManagerInstance: GitManager | null = null;

/**
 * Get the singleton GitManager instance
 */
export function getGitManager(): GitManager {
  if (!gitManagerInstance) {
    gitManagerInstance = new GitManager();
  }
  return gitManagerInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetGitManager(): void {
  gitManagerInstance = null;
}
