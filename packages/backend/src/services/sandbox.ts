export interface SandboxRunOptions {
  missionId: string;
  runId: string;
  stepId: string;
  image: string;
  command: string[];
  env?: Record<string, string>;
  workingDir?: string;
  artifactsPath: string;  // Host path to mount
  workspacePath?: string;  // Cloned project path
  nodeModulesPath?: string; // Original's node_modules
  labels?: Record<string, string>;
}

// Options for Claude sandbox streaming execution
export interface ClaudeSandboxOptions {
  missionId: string;
  runId: string;
  stepId: string;
  artifactsPath: string;   // Working directory for Claude
  prompt: string;          // The prompt to send to Claude
  workspacePath?: string;  // Cloned project path to mount at /workspace
  nodeModulesPath?: string; // Original project's node_modules to mount (read-only)
}

// Stream events from Claude sandbox output
export interface StreamEvent {
  type: 'assistant' | 'result' | 'error' | 'tool_use' | 'init';
  text?: string;
  result?: string;
  toolName?: string;
  isComplete?: boolean;    // True when <promise>COMPLETE</promise> detected
}

export interface SandboxStatus {
  state: 'running' | 'exited' | 'unknown';
  exitCode?: number;
  startedAt?: string;
  finishedAt?: string;
}

export interface SandboxProvider {
  /**
   * Start a new sandbox for a step run
   * Returns the container/job ID
   */
  start(options: SandboxRunOptions): Promise<string>;

  /**
   * Get status of a sandbox
   */
  getStatus(containerId: string): Promise<SandboxStatus>;

  /**
   * Get log tail from a sandbox
   */
  getLogTail(containerId: string, bytes?: number): Promise<string>;

  /**
   * Stop a running sandbox
   */
  stop(containerId: string): Promise<void>;

  /**
   * Remove a sandbox (cleanup)
   */
  remove(containerId: string): Promise<void>;

  /**
   * Check if provider is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Cleanup orphaned resources (e.g., containers with haflow labels)
   */
  cleanupOrphaned(): Promise<void>;

  /**
   * Start Claude sandbox with streaming output
   * Returns an async generator that yields StreamEvents
   */
  startClaudeStreaming?(options: ClaudeSandboxOptions): AsyncGenerator<StreamEvent, void, unknown>;
}
