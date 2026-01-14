import { LogLevel } from './enums.js'

export interface LogEntry {
  id: string
  missionId: string
  level: LogLevel
  message: string
  timestamp: string
  metadata: Record<string, unknown> | null
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: ApiError
}

export interface ApiError {
  code: string
  message: string
  details?: unknown
}

export interface PaginationParams {
  limit?: number
  offset?: number
}

export interface LogQueryParams extends PaginationParams {
  missionId: string
  level?: LogLevel
}
