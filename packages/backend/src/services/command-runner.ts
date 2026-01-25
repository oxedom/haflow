import { exec } from 'child_process';
import { join } from 'path';
import { config } from '../utils/config.js';
import { randomUUID } from 'crypto';

interface CommandExecution {
  id: string;
  command: string;
  status: 'running' | 'completed' | 'failed';
  output: string;
  exitCode?: number;
  startedAt: string;
  finishedAt?: string;
}

// In-memory store for command executions (keyed by execution ID)
const executions = new Map<string, CommandExecution>();

// Cleanup old executions after 5 minutes
const EXECUTION_TTL = 5 * 60 * 1000;

export async function executeCommand(
  missionId: string,
  command: string,
  timeoutMs: number = 60000
): Promise<string> {
  const projectPath = join(config.missionsDir, missionId, 'project');
  const executionId = `exec-${randomUUID().slice(0, 8)}`;

  const execution: CommandExecution = {
    id: executionId,
    command,
    status: 'running',
    output: '',
    startedAt: new Date().toISOString(),
  };

  executions.set(executionId, execution);

  // Clean up old executions
  cleanupOldExecutions();

  // Run command asynchronously
  runCommand(executionId, command, projectPath, timeoutMs);

  return executionId;
}

function runCommand(
  executionId: string,
  command: string,
  cwd: string,
  timeoutMs: number
): void {
  const execution = executions.get(executionId);
  if (!execution) return;

  const child = exec(command, {
    cwd,
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024, // 10MB
  });

  child.stdout?.on('data', (data) => {
    execution.output += data;
  });

  child.stderr?.on('data', (data) => {
    execution.output += data;
  });

  child.on('close', (code) => {
    execution.status = code === 0 ? 'completed' : 'failed';
    execution.exitCode = code ?? 1;
    execution.finishedAt = new Date().toISOString();
  });

  child.on('error', (err) => {
    execution.status = 'failed';
    execution.output += `\nError: ${err.message}`;
    execution.exitCode = 1;
    execution.finishedAt = new Date().toISOString();
  });
}

export function getExecution(executionId: string): CommandExecution | undefined {
  return executions.get(executionId);
}

function cleanupOldExecutions(): void {
  const now = Date.now();
  for (const [id, exec] of executions) {
    if (exec.finishedAt) {
      const finishedTime = new Date(exec.finishedAt).getTime();
      if (now - finishedTime > EXECUTION_TTL) {
        executions.delete(id);
      }
    }
  }
}
