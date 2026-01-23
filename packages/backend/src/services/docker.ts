import { exec } from 'child_process';
import { promisify } from 'util';
import type { SandboxProvider, SandboxRunOptions, SandboxStatus } from './sandbox.js';

const execAsync = promisify(exec);

const LABEL_PREFIX = 'haloop';

const defaultImage = 'node:20-slim'; // Default agent image for v0

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
    workingDir = '/mission',
    artifactsPath,
  } = options;

  const labels = [
    `--label=${LABEL_PREFIX}.mission_id=${missionId}`,
    `--label=${LABEL_PREFIX}.run_id=${runId}`,
    `--label=${LABEL_PREFIX}.step_id=${stepId}`,
  ];

  const envArgs = Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]);

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
    '-v', `${artifactsPath}:${workingDir}/artifacts`,
    '-w', workingDir,
    image || defaultImage,
    ...escapedCommand,
  ];

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
    // Find and remove all containers with haloop labels
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

export const dockerProvider: SandboxProvider = {
  start,
  getStatus,
  getLogTail,
  stop,
  remove,
  isAvailable,
  cleanupOrphaned,
};
