import { Router, type Request, type Response, type NextFunction } from 'express'
import { LogLevel, type LogEntry, type ApiResponse } from '@ralphy/shared'
import { getDatabase } from '../database/connection.js'
import { ValidationError } from '../middleware/error-handler.js'

interface LogRow {
  id: string
  mission_id: string
  level: string
  message: string
  timestamp: string
  metadata: string | null
}

function rowToLogEntry(row: LogRow): LogEntry {
  return {
    id: row.id,
    missionId: row.mission_id,
    level: row.level as LogLevel,
    message: row.message,
    timestamp: row.timestamp,
    metadata: row.metadata ? JSON.parse(row.metadata) : null
  }
}

export function createLogsRouter(): Router {
  const router = Router()

  // GET /api/logs - Get logs (missionId required)
  router.get('/', (req: Request, res: Response<ApiResponse<LogEntry[]>>, next: NextFunction) => {
    try {
      const { missionId, level, limit = '100' } = req.query

      if (!missionId || typeof missionId !== 'string') {
        throw new ValidationError('missionId query parameter is required')
      }

      const db = getDatabase()
      let query = 'SELECT * FROM logs WHERE mission_id = ?'
      const params: (string | number)[] = [missionId]

      if (level && typeof level === 'string') {
        if (!Object.values(LogLevel).includes(level as LogLevel)) {
          throw new ValidationError(`Invalid log level: ${level}`)
        }
        query += ' AND level = ?'
        params.push(level)
      }

      query += ' ORDER BY timestamp DESC'

      const limitNum = parseInt(limit as string, 10)
      if (!isNaN(limitNum) && limitNum > 0) {
        query += ' LIMIT ?'
        params.push(limitNum)
      }

      const rows = db.prepare(query).all(...params) as LogRow[]
      const logs = rows.map(rowToLogEntry)

      res.json({ success: true, data: logs })
    } catch (error) {
      next(error)
    }
  })

  return router
}
