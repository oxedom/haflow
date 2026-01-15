import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import treeKill from 'tree-kill';
import { ProcessStatus } from '@ralphy/shared';
import { ProcessRepository, CreateProcessData } from '../database/repositories/processes';

/**
 * Options for spawning a local process
 */
export interface SpawnLocalOptions {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  missionId?: string;
}

/**
 * Output event data emitted by the Orchestrator
 */
export interface OutputEvent {
  processId: string;
  stream: 'stdout' | 'stderr';
  data: string;
}

/**
 * Exit event data emitted by the Orchestrator
 */
export interface ExitEvent {
  processId: string;
  code: number | null;
  signal: string | null;
}

/**
 * Orchestrator service for spawning and managing local processes.
 * Extends EventEmitter to emit 'output' and 'exit' events.
 *
 * Events:
 * - 'output': Emitted when process writes to stdout/stderr
 * - 'exit': Emitted when process exits
 */
export class Orchestrator extends EventEmitter {
  private processes: Map<string, ChildProcess> = new Map();
  private processRepo: ProcessRepository;

  constructor(processRepo?: ProcessRepository) {
    super();
    this.processRepo = processRepo || new ProcessRepository();
  }

  /**
   * Spawn a local process
   * Creates a database record, spawns the process, and sets up event handlers
   */
  spawnLocal(opts: SpawnLocalOptions): string {
    // Create database record for the process
    const createData: CreateProcessData = {
      type: 'local',
      command: `${opts.command} ${opts.args.join(' ')}`,
      cwd: opts.cwd,
      missionId: opts.missionId,
      env: opts.env,
    };
    const processRecord = this.processRepo.create(createData);
    const processId = processRecord.id;

    // Spawn the process with detached mode and piped stdio
    const childProcess = spawn(opts.command, opts.args, {
      cwd: opts.cwd,
      env: opts.env ? { ...process.env, ...opts.env } : process.env,
      stdio: 'pipe',
      detached: true,
    });

    // Store the child process
    this.processes.set(processId, childProcess);

    // Update database with PID
    if (childProcess.pid) {
      this.processRepo.updatePid(processId, childProcess.pid, childProcess.pid);
      this.processRepo.updateStatus(processId, ProcessStatus.RUNNING);
    }

    // Set up stdout handler
    childProcess.stdout?.on('data', (data: Buffer) => {
      const outputEvent: OutputEvent = {
        processId,
        stream: 'stdout',
        data: data.toString(),
      };
      this.emit('output', outputEvent);
    });

    // Set up stderr handler
    childProcess.stderr?.on('data', (data: Buffer) => {
      const outputEvent: OutputEvent = {
        processId,
        stream: 'stderr',
        data: data.toString(),
      };
      this.emit('output', outputEvent);
    });

    // Set up exit handler
    childProcess.on('exit', (code: number | null, signal: string | null) => {
      // Remove from active processes
      this.processes.delete(processId);

      // Update database status based on exit code
      const status = code === 0 ? ProcessStatus.SUCCESS : ProcessStatus.ERROR;
      this.processRepo.updateStatus(processId, status, code ?? undefined);

      // Emit exit event
      const exitEvent: ExitEvent = {
        processId,
        code,
        signal,
      };
      this.emit('exit', exitEvent);
    });

    // Set up error handler for spawn failures
    childProcess.on('error', (err: Error) => {
      // Remove from active processes
      this.processes.delete(processId);

      // Update database status to error
      this.processRepo.updateStatus(processId, ProcessStatus.ERROR);

      // Emit exit event with null code
      const exitEvent: ExitEvent = {
        processId,
        code: null,
        signal: null,
      };
      this.emit('exit', exitEvent);

      // Re-emit the error
      this.emit('error', { processId, error: err });
    });

    return processId;
  }

  /**
   * Kill a process by its ID using tree-kill to kill the entire process tree
   */
  kill(processId: string, signal: 'SIGTERM' | 'SIGKILL' = 'SIGTERM'): Promise<void> {
    return new Promise((resolve, reject) => {
      const childProcess = this.processes.get(processId);

      if (!childProcess || !childProcess.pid) {
        // Process not found in memory, update database status if it exists
        const processRecord = this.processRepo.findById(processId);
        if (processRecord && processRecord.status === ProcessStatus.RUNNING) {
          this.processRepo.updateStatus(processId, ProcessStatus.CANCELED);
        }
        resolve();
        return;
      }

      // Use tree-kill to kill the entire process tree
      treeKill(childProcess.pid, signal, (err) => {
        if (err) {
          // Process may have already exited
          if (err.message && err.message.includes('No such process')) {
            this.processes.delete(processId);
            this.processRepo.updateStatus(processId, ProcessStatus.CANCELED);
            resolve();
          } else {
            reject(err);
          }
        } else {
          // Update status to canceled
          this.processRepo.updateStatus(processId, ProcessStatus.CANCELED);
          this.processes.delete(processId);
          resolve();
        }
      });
    });
  }

  /**
   * Get a running process by ID
   */
  getProcess(processId: string): ChildProcess | undefined {
    return this.processes.get(processId);
  }

  /**
   * Check if a process is currently running
   */
  isRunning(processId: string): boolean {
    return this.processes.has(processId);
  }

  /**
   * Get all currently running process IDs
   */
  getRunningProcessIds(): string[] {
    return Array.from(this.processes.keys());
  }

  /**
   * Cleanup all processes - kills all running processes
   */
  async cleanup(): Promise<void> {
    const processIds = Array.from(this.processes.keys());
    await Promise.all(processIds.map((id) => this.kill(id, 'SIGTERM')));
  }
}

// Singleton instance
let orchestratorInstance: Orchestrator | null = null;

/**
 * Get the singleton Orchestrator instance
 */
export function getOrchestrator(): Orchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new Orchestrator();
  }
  return orchestratorInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetOrchestrator(): void {
  if (orchestratorInstance) {
    orchestratorInstance.cleanup().catch(() => {});
  }
  orchestratorInstance = null;
}
