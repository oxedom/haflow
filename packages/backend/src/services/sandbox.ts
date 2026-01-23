export interface SandboxRunOptions {
  missionId: string;
  runId: string;
  stepId: string;
  image: string;
  command: string[];
  env?: Record<string, string>;
  workingDir?: string;
  artifactsPath: string;  // Host path to mount
  labels?: Record<string, string>;
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
   * Cleanup orphaned resources (e.g., containers with haloop labels)
   */
  cleanupOrphaned(): Promise<void>;
}
