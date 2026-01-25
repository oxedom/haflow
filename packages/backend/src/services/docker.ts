import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as readline from 'readline';
import { existsSync } from 'fs';
import type { SandboxProvider, SandboxRunOptions, SandboxStatus, ClaudeSandboxOptions, StreamEvent } from './sandbox.js';
import { missionStore } from './mission-store.js';

const execAsync = promisify(exec);

const LABEL_PREFIX = 'haflow';

const defaultImage = 'docker/sandbox-templates:claude-code';

async function isAvailable(): Promise<boolean> {
  try {
    await execAsync('docker version');
    return true;
  } catch {
    return false;
  }
}

// Shell-escape a string for use in a command
function shellEscape(s: string): string {
  // Wrap in single quotes and escape any existing single quotes
  return `'${s.replace(/'/g, "'\\''")}'`;
}

async function start(options: SandboxRunOptions): Promise<string> {
  const {
    missionId,
    runId,
    stepId,
    image,
    command,
    env = {},
    workingDir: explicitWorkingDir,
    artifactsPath,
    workspacePath,
    nodeModulesPath,
  } = options;

  // Determine working directory:
  // 1. Explicit workingDir takes precedence
  // 2. If workspacePath provided, use /workspace (codegen mode)
  // 3. Default to /mission (document mode)
  const workingDir = explicitWorkingDir ?? (workspacePath ? '/workspace' : '/mission');

  const labels = [
    `--label=${LABEL_PREFIX}.mission_id=${missionId}`,
    `--label=${LABEL_PREFIX}.run_id=${runId}`,
    `--label=${LABEL_PREFIX}.step_id=${stepId}`,
  ];

  const envArgs = Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]);

  // Git config file path from host
  const homeDir = process.env.HOME || '/home/user';
  const gitConfigPath = process.env.GIT_CONFIG_PATH || `${homeDir}/.gitconfig`;

  // Properly escape command arguments for shell execution
  // Special handling for 'sh -c <script>' pattern
  let escapedCommand: string[];
  if (command[0] === 'sh' && command[1] === '-c' && command.length === 3) {
    // Quote the script argument to preserve shell metacharacters
    escapedCommand = ['sh', '-c', shellEscape(command[2]!)];
  } else {
    // For other commands, escape each argument
    escapedCommand = command.map(arg =>
      arg.includes(' ') || arg.includes('"') || arg.includes("'") || arg.includes('>') || arg.includes('<')
        ? shellEscape(arg)
        : arg
    );
  }

  const args = [
    'run',
    '-d',
    // Note: NOT using --rm so we can inspect exit status before cleanup
    '--user', `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
    ...labels,
    ...envArgs,
  ];

  // Mount workspace (cloned project) if in codegen mode
  // Must be mounted BEFORE artifacts so artifacts can overlay
  if (workspacePath) {
    args.push('-v', `${workspacePath}:/workspace`);

    // Mount original's node_modules for runtime (read-only)
    if (nodeModulesPath && existsSync(nodeModulesPath)) {
      args.push('-v', `${nodeModulesPath}:/workspace/node_modules:ro`);
    }
  }

  // Mount artifacts at {workingDir}/artifacts
  args.push('-v', `${artifactsPath}:${workingDir}/artifacts`);

  args.push(
    '-w', workingDir,
    image || defaultImage,
    ...escapedCommand,
  );

  // Mount git config if it exists on host
  if (existsSync(gitConfigPath)) {
    // Insert git config volume mount before the -w workingDir argument
    const workingDirIndex = args.indexOf('-w');
    args.splice(workingDirIndex, 0, '-v', `${gitConfigPath}:/home/agent/.gitconfig:ro`);
  }

  const { stdout } = await execAsync(`docker ${args.join(' ')}`);
  const containerId = stdout.trim();

  return containerId;
}

async function getStatus(containerId: string): Promise<SandboxStatus> {
  try {
    const { stdout } = await execAsync(
      `docker inspect --format='{{.State.Status}}|{{.State.ExitCode}}|{{.State.StartedAt}}|{{.State.FinishedAt}}' ${containerId}`
    );

    const [status, exitCode, startedAt, finishedAt] = stdout.trim().split('|');

    const state = status === 'running' ? 'running' :
      status === 'exited' ? 'exited' : 'unknown';

    return {
      state,
      exitCode: state === 'exited' && exitCode ? parseInt(exitCode, 10) : undefined,
      startedAt: startedAt !== '0001-01-01T00:00:00Z' ? startedAt : undefined,
      finishedAt: finishedAt !== '0001-01-01T00:00:00Z' ? finishedAt : undefined,
    };
  } catch {
    return { state: 'unknown' };
  }
}

async function getLogTail(containerId: string, bytes = 2000): Promise<string> {
  try {
    const { stdout } = await execAsync(`docker logs --tail 100 ${containerId} 2>&1`);
    return stdout.slice(-bytes);
  } catch {
    return '';
  }
}

async function stop(containerId: string): Promise<void> {
  try {
    await execAsync(`docker stop ${containerId}`);
  } catch {
    // Ignore errors (container may already be stopped)
  }
}

async function remove(containerId: string): Promise<void> {
  try {
    await execAsync(`docker rm -f ${containerId}`);
  } catch {
    // Ignore errors (container may already be removed)
  }
}

async function cleanupOrphaned(): Promise<void> {
  try {
    // Find and remove all containers with haflow labels
    const { stdout } = await execAsync(
      `docker ps -aq --filter="label=${LABEL_PREFIX}.mission_id"`
    );

    const containerIds = stdout.trim().split('\n').filter(Boolean);

    for (const id of containerIds) {
      await remove(id);
    }
  } catch {
    // Ignore cleanup errors on startup
  }
}

async function removeByMissionId(missionId: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `docker ps -aq --filter="label=${LABEL_PREFIX}.mission_id=${missionId}"`
    );
    const ids = stdout.trim().split('\n').filter(Boolean);
    for (const id of ids) {
      await remove(id);
    }
    return ids.length;
  } catch {
    // Ignore errors - containers may not exist
    return 0;
  }
}

// COMPLETE marker for Ralph loop detection
const COMPLETE_MARKER = '<promise>COMPLETE</promise>';

// Parse a single line of stream-json output from Claude
// Exported for testing
export function parseStreamJsonLine(line: string): StreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Early validation: only process JSON lines (skip docker noise)
  if (!trimmed.startsWith('{')) {
    console.debug('[stream-json] Skipping non-JSON line:', trimmed.slice(0, 100));
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);

    // Handle different message types from Claude's stream-json output
    if (parsed.type === 'assistant') {
      // Extract text from ALL content blocks, not just the first
      // Filter for blocks that are either type: 'text' or have no type (text is assumed)
      const contentBlocks = parsed.message?.content || [];
      const text = contentBlocks
        .filter((c: { type?: string; text?: string }) => !c.type || c.type === 'text')
        .map((c: { text?: string }) => c.text || '')
        .join('');
      return {
        type: 'assistant',
        text,
        isComplete: text.includes(COMPLETE_MARKER),
      };
    }

    if (parsed.type === 'content_block_delta') {
      const text = parsed.delta?.text || '';
      return {
        type: 'assistant',
        text,
        isComplete: text.includes(COMPLETE_MARKER),
      };
    }

    if (parsed.type === 'tool_use') {
      return {
        type: 'tool_use',
        toolName: parsed.name,
        text: JSON.stringify(parsed.input, null, 2),
      };
    }

    if (parsed.type === 'result') {
      return {
        type: 'result',
        result: parsed.result || parsed.subtype,
        isComplete: true,
      };
    }

    if (parsed.type === 'error') {
      return {
        type: 'error',
        text: parsed.error?.message || parsed.message || 'Unknown error',
      };
    }

    // Init/system messages
    if (parsed.type === 'system' || parsed.type === 'init') {
      return {
        type: 'init',
        text: parsed.message || 'Session initialized',
      };
    }

    return null;
  } catch {
    // Malformed JSON (starts with '{' but isn't valid) - log and skip
    console.debug('[stream-json] Failed to parse JSON line:', trimmed.slice(0, 100));
    return null;
  }
}

/**
 * Copy files or directories from container to host using docker cp (works on stopped containers)
 * @param containerId - Container ID or name
 * @param containerPath - Path inside container (e.g., '/mission/some-file.txt' or '/mission')
 * @param hostPath - Destination path on host
 */
async function copyFromContainer(containerId: string, containerPath: string, hostPath: string): Promise<void> {
  try {
    await execAsync(`docker cp ${containerId}:${containerPath} ${hostPath}`);
  } catch (error) {
    // Directory might not exist or be empty - that's okay for directory copies
    if (error instanceof Error && error.message.includes('No such container')) {
      throw error;
    }
    // Other errors (like file/directory not existing) are non-fatal for extraction
  }
}

async function* startClaudeStreaming(options: ClaudeSandboxOptions): AsyncGenerator<StreamEvent, void, unknown> {
  const { artifactsPath, prompt, workspacePath, nodeModulesPath, missionId, runId } = options;

  // Determine working directory based on mode
  // Code-gen mode: /workspace (cloned project mounted here)
  // Document mode: /mission (default)
  const workingDir = workspacePath ? '/workspace' : '/mission';
  const homeDir = process.env.HOME || '/home/user';

  // Claude credentials file path from host
  const claudeAuthPath = process.env.CLAUDE_AUTH_PATH || `${homeDir}/.claude/.credentials.json`;

  // Git config file path from host
  const gitConfigPath = process.env.GIT_CONFIG_PATH || `${homeDir}/.gitconfig`;

  // Generate a unique container name so we can reference it even after process exits
  const containerName = `haflow-claude-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  // Build docker run command with defaultImage
  // Note: NOT using --rm so we can extract files after completion
  const args = [
    'run',
    '--name', containerName,
    '-i',
    '--user', `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
    '-v', `${claudeAuthPath}:/home/agent/.claude/.credentials.json:ro`,
  ];

  // Mount workspace (cloned project) if in codegen mode
  // Must be mounted BEFORE artifacts so artifacts can overlay
  if (workspacePath) {
    args.push('-v', `${workspacePath}:/workspace`);

    // Mount original's node_modules for runtime (read-only)
    // This avoids duplicating node_modules in the clone
    if (nodeModulesPath && existsSync(nodeModulesPath)) {
      args.push('-v', `${nodeModulesPath}:/workspace/node_modules:ro`);
    }
  }

  // Mount artifacts at {workingDir}/artifacts
  // In codegen mode: /workspace/artifacts (overlays clone's artifacts if any)
  // In document mode: /mission/artifacts
  args.push('-v', `${artifactsPath}:${workingDir}/artifacts`);

  args.push(
    '-w', workingDir,
    defaultImage,
    'claude',
    '--model', 'claude-haiku-4-5',
    '--verbose',
    '--print',
    '--output-format', 'stream-json',
    '--dangerously-skip-permissions',
    prompt,
  );

  // Mount git config if it exists on host
  if (existsSync(gitConfigPath)) {
    // Insert git config volume mount before the -w workingDir argument
    const workingDirIndex = args.indexOf('-w');
    args.splice(workingDirIndex, 0, '-v', `${gitConfigPath}:/home/agent/.gitconfig:ro`);
  }

  const childProcess = spawn('docker', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Capture stderr in parallel
  let stderrOutput = '';
  childProcess.stderr.on('data', (data) => {
    const chunk = data.toString();
    stderrOutput += chunk;
    // Capture to docker stderr log
    missionStore.appendDockerStderr(missionId, runId, chunk).catch(() => {
      // Ignore write errors to not disrupt streaming
    });
  });

  // Capture raw stdout to docker stdout log
  childProcess.stdout.on('data', (data) => {
    const chunk = data.toString();
    missionStore.appendDockerStdout(missionId, runId, chunk).catch(() => {
      // Ignore write errors to not disrupt streaming
    });
  });

  // Create readline interface to parse line-by-line
  const rl = readline.createInterface({
    input: childProcess.stdout,
    crlfDelay: Infinity,
  });

  let accumulatedText = '';
  let isComplete = false;

  // Process stdout line by line
  for await (const line of rl) {
    const event = parseStreamJsonLine(line);
    if (event) {
      // Accumulate text for COMPLETE detection
      if (event.text) {
        accumulatedText += event.text;
        if (accumulatedText.includes(COMPLETE_MARKER)) {
          event.isComplete = true;
          isComplete = true;
        }
      }
      yield event;
    }
  }

  // Wait for process to exit
  await new Promise<void>((resolve, reject) => {
    childProcess.on('close', (code) => {
      if (code !== 0 && !isComplete) {
        reject(new Error(`Claude container exited with code ${code}: ${stderrOutput}`));
      } else {
        resolve();
      }
    });
    childProcess.on('error', reject);
  });

  // Extract any files created outside the artifacts directory (document mode only)
  // In codegen mode, workspace is bind-mounted so all changes are already on host
  // In document mode, files in /mission/artifacts are via volume mount, but files
  // created directly in /mission need to be extracted
  if (!workspacePath) {
    try {
      // Create a temp directory to copy the entire /mission directory
      const { mkdtemp } = await import('fs/promises');
      const { join } = await import('path');
      const { tmpdir } = await import('os');
      const tempDir = await mkdtemp(join(tmpdir(), 'haflow-extract-'));

      // Copy entire /mission directory from container
      await copyFromContainer(containerName, workingDir, tempDir);

      // Move any files from tempDir/mission/* (excluding artifacts) to artifactsPath
      const { readdir, stat, copyFile, rm } = await import('fs/promises');
      const missionDir = join(tempDir, 'mission');

      try {
        const entries = await readdir(missionDir);
        for (const entry of entries) {
          // Skip artifacts directory (already on host via volume mount)
          if (entry === 'artifacts') continue;

          const sourcePath = join(missionDir, entry);
          const stats = await stat(sourcePath);

          if (stats.isFile()) {
            const destPath = join(artifactsPath, entry);
            await copyFile(sourcePath, destPath);
          } else if (stats.isDirectory()) {
            // For directories, copy the entire directory contents
            // docker cp container:src dest - if dest exists, copies contents into it
            const destPath = join(artifactsPath, entry);
            // Ensure destination directory exists
            const { mkdir } = await import('fs/promises');
            await mkdir(destPath, { recursive: true });
            // Copy directory contents (docker cp copies into existing directory)
            await copyFromContainer(containerName, `${workingDir}/${entry}/.`, destPath);
          }
        }

        // Clean up temp directory
        await rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        // Clean up temp directory even on error
        await rm(tempDir, { recursive: true, force: true }).catch(() => { });
        // Non-fatal - files in artifacts are already accessible
      }
    } catch (error) {
      // Log but don't fail - extraction is best-effort
      // Files in /mission/artifacts are already accessible via volume mount
      if (error instanceof Error && !error.message.includes('No such container')) {
        // Only log if it's not a container-not-found error (which is expected if container was already removed)
      }
    }
  }

  // Always clean up the container
  try {
    await remove(containerName);
  } catch {
    // Container might already be removed - that's okay
  }

  // Final result event
  yield {
    type: 'result',
    result: isComplete ? 'completed' : 'finished',
    isComplete,
  };
}

export const dockerProvider: SandboxProvider = {
  start,
  getStatus,
  getLogTail,
  stop,
  remove,
  isAvailable,
  cleanupOrphaned,
  removeByMissionId,
  startClaudeStreaming,
};
