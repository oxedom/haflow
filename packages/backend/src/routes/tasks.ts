import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { TaskStatus, type Task, type ApiResponse } from '@ralphy/shared'
import { getDatabase } from '../database/connection.js'
import { NotFoundError, ValidationError } from '../middleware/error-handler.js'

const updateTaskSchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  output: z.string().optional(),
  passes: z.number().int().min(0).optional()
})

interface TaskRow {
  id: string
  mission_id: string
  category: string
  description: string
  order_num: number
  status: string
  agents: string | null
  skills: string | null
  steps_to_verify: string | null
  passes: number
  output: string | null
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    missionId: row.mission_id,
    category: row.category,
    description: row.description,
    order: row.order_num,
    status: row.status as TaskStatus,
    agents: row.agents ? JSON.parse(row.agents) : [],
    skills: row.skills ? JSON.parse(row.skills) : [],
    stepsToVerify: row.steps_to_verify ? JSON.parse(row.steps_to_verify) : [],
    passes: row.passes,
    output: row.output
  }
}

export function createTasksRouter(): Router {
  const router = Router()

  // GET /api/tasks - List tasks (missionId required)
  router.get('/', (req: Request, res: Response<ApiResponse<Task[]>>, next: NextFunction) => {
    try {
      const { missionId } = req.query

      if (!missionId || typeof missionId !== 'string') {
        throw new ValidationError('missionId query parameter is required')
      }

      const db = getDatabase()
      const rows = db.prepare('SELECT * FROM tasks WHERE mission_id = ? ORDER BY order_num ASC').all(missionId) as TaskRow[]
      const tasks = rows.map(rowToTask)

      res.json({ success: true, data: tasks })
    } catch (error) {
      next(error)
    }
  })

  // GET /api/tasks/:id - Get task
  router.get('/:id', (req: Request, res: Response<ApiResponse<Task>>, next: NextFunction) => {
    try {
      const { id } = req.params
      const db = getDatabase()
      const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined

      if (!row) {
        throw new NotFoundError('Task', id ?? 'unknown')
      }

      const task = rowToTask(row)
      res.json({ success: true, data: task })
    } catch (error) {
      next(error)
    }
  })

  // PATCH /api/tasks/:id - Update task
  router.patch('/:id', (req: Request, res: Response<ApiResponse<Task>>, next: NextFunction) => {
    try {
      const { id } = req.params
      const parsed = updateTaskSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new ValidationError('Invalid input', parsed.error.errors)
      }

      const db = getDatabase()
      const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined

      if (!existing) {
        throw new NotFoundError('Task', id ?? 'unknown')
      }

      const { status, output, passes } = parsed.data
      const updates: string[] = []
      const values: (string | number)[] = []

      if (status !== undefined) {
        updates.push('status = ?')
        values.push(status)
      }
      if (output !== undefined) {
        updates.push('output = ?')
        values.push(output)
      }
      if (passes !== undefined) {
        updates.push('passes = ?')
        values.push(passes)
      }

      if (updates.length > 0) {
        values.push(id!)
        db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values)
      }

      const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow
      const task = rowToTask(row)

      res.json({ success: true, data: task })
    } catch (error) {
      next(error)
    }
  })

  return router
}
