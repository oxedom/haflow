export enum MissionStatus {
  DRAFT = 'draft',
  GENERATING_PRD = 'generating_prd',
  PRD_REVIEW = 'prd_review',
  PREPARING_TASKS = 'preparing_tasks',
  TASKS_REVIEW = 'tasks_review',
  IN_PROGRESS = 'in_progress',
  COMPLETED_SUCCESS = 'completed_success',
  COMPLETED_FAILED = 'completed_failed'
}

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped'
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export function isMissionStatus(value: string): value is MissionStatus {
  return Object.values(MissionStatus).includes(value as MissionStatus)
}

export function isTaskStatus(value: string): value is TaskStatus {
  return Object.values(TaskStatus).includes(value as TaskStatus)
}

export function isLogLevel(value: string): value is LogLevel {
  return Object.values(LogLevel).includes(value as LogLevel)
}
