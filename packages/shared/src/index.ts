/**
 * Mission state machine states
 * Represents the lifecycle of a mission from draft to completion
 */
export enum MissionState {
  DRAFT = 'draft',
  GENERATING_PRD = 'generating_prd',
  PRD_REVIEW = 'prd_review',
  PREPARING_TASKS = 'preparing_tasks',
  TASKS_REVIEW = 'tasks_review',
  IN_PROGRESS = 'in_progress',
  COMPLETED_SUCCESS = 'completed_success',
  COMPLETED_FAILED = 'completed_failed',
}

/**
 * Task execution status
 * Represents the state of individual tasks within a mission
 */
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

/**
 * Process execution status
 * Represents the state of spawned processes (Claude CLI, Docker containers)
 */
export enum ProcessStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  SUCCESS = 'success',
  ERROR = 'error',
  CANCELED = 'canceled',
}

/**
 * Log levels for mission execution logging
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}
