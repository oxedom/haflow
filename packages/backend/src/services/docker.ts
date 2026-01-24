import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as readline from 'readline';
import type { SandboxProvider, SandboxRunOptions, SandboxStatus, ClaudeSandboxOptions, StreamEvent } from './sandbox.js';

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

// COMPLETE marker for Ralph loop detection
const COMPLETE_MARKER = '<promise>COMPLETE</promise>';

// Parse a single line of stream-json output from Claude
// Exported for testing
export function parseStreamJsonLine(line: string): StreamEvent | null {
  if (!line.trim()) return null;

  try {
    const parsed = JSON.parse(line);

    // Handle different message types from Claude's stream-json output
    if (parsed.type === 'assistant') {
      const text = parsed.message?.content?.[0]?.text || '';
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
    // Not valid JSON, treat as plain text
    return {
      type: 'assistant',
      text: line,
      isComplete: line.includes(COMPLETE_MARKER),
    };
  }
}

async function* startClaudeStreaming(options: ClaudeSandboxOptions): AsyncGenerator<StreamEvent, void, unknown> {
  const { artifactsPath, prompt } = options;

  // Build docker sandbox run claude command
  const args = [
    'sandbox', 'run',
    '-w', artifactsPath,
    '--credentials', 'host',
    'claude',
    '--print',
    '--output-format', 'stream-json',
    '--dangerously-skip-permissions',
    prompt,
  ];

  const childProcess = spawn('docker', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
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

  // Handle stderr
  let stderrOutput = '';
  childProcess.stderr.on('data', (data) => {
    stderrOutput += data.toString();
  });

  // Wait for process to exit
  await new Promise<void>((resolve, reject) => {
    childProcess.on('close', (code) => {
      if (code !== 0 && !isComplete) {
        reject(new Error(`Claude sandbox exited with code ${code}: ${stderrOutput}`));
      } else {
        resolve();
      }
    });
    childProcess.on('error', reject);
  });

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
  startClaudeStreaming,
};
