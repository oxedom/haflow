import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { v4 as uuid } from 'uuid'
import { MissionStatus, type Mission, type ApiResponse } from '@ralphy/shared'
import { getDatabase } from '../database/connection.js'
import { NotFoundError, ValidationError, AppError } from '../middleware/error-handler.js'

const createMissionSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  name: z.string().min(1, 'Name is required'),
  draftContent: z.string().min(1, 'Draft content is required')
})

const updateMissionSchema = z.object({
  name: z.string().min(1).optional(),
  draftContent: z.string().optional(),
  prdContent: z.string().optional(),
  status: z.nativeEnum(MissionStatus).optional()
})

interface MissionRow {
  id: string
  project_id: string
  name: string
  status: string
  branch_name: string | null
  draft_content: string
  prd_content: string | null
  prd_iterations: number
  tasks_iterations: number
  created_at: string
  updated_at: string
  started_at: string | null
  completed_at: string | null
  container_id: string | null
  worktree_path: string | null
}

function rowToMission(row: MissionRow): Mission {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    status: row.status as MissionStatus,
    branchName: row.branch_name,
    draftContent: row.draft_content,
    prdContent: row.prd_content,
    prdIterations: row.prd_iterations,
    tasksIterations: row.tasks_iterations,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    containerId: row.container_id,
    worktreePath: row.worktree_path
  }
}

// Valid state transitions
const validTransitions: Record<MissionStatus, MissionStatus[]> = {
  [MissionStatus.DRAFT]: [MissionStatus.GENERATING_PRD],
  [MissionStatus.GENERATING_PRD]: [MissionStatus.PRD_REVIEW, MissionStatus.DRAFT],
  [MissionStatus.PRD_REVIEW]: [MissionStatus.PREPARING_TASKS, MissionStatus.DRAFT],
  [MissionStatus.PREPARING_TASKS]: [MissionStatus.TASKS_REVIEW, MissionStatus.DRAFT],
  [MissionStatus.TASKS_REVIEW]: [MissionStatus.IN_PROGRESS, MissionStatus.DRAFT],
  [MissionStatus.IN_PROGRESS]: [MissionStatus.COMPLETED_SUCCESS, MissionStatus.COMPLETED_FAILED, MissionStatus.DRAFT],
  [MissionStatus.COMPLETED_SUCCESS]: [MissionStatus.DRAFT],
  [MissionStatus.COMPLETED_FAILED]: [MissionStatus.DRAFT]
}

function canTransition(from: MissionStatus, to: MissionStatus): boolean {
  return validTransitions[from]?.includes(to) ?? false
}

export function createMissionsRouter(): Router {
  const router = Router()

  // GET /api/missions - List missions
  router.get('/', (req: Request, res: Response<ApiResponse<Mission[]>>, next: NextFunction) => {
    try {
      const db = getDatabase()
      const { projectId } = req.query

      let query = 'SELECT * FROM missions'
      const params: string[] = []

      if (projectId && typeof projectId === 'string') {
        query += ' WHERE project_id = ?'
        params.push(projectId)
      }

      query += ' ORDER BY created_at DESC'

      const rows = db.prepare(query).all(...params) as MissionRow[]
      const missions = rows.map(rowToMission)

      res.json({ success: true, data: missions })
    } catch (error) {
      next(error)
    }
  })

  // POST /api/missions - Create mission
  router.post('/', (req: Request, res: Response<ApiResponse<Mission>>, next: NextFunction) => {
    try {
      const parsed = createMissionSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new ValidationError('Invalid input', parsed.error.errors)
      }

      const { projectId, name, draftContent } = parsed.data
      const db = getDatabase()

      // Verify project exists
      const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)
      if (!project) {
        throw new NotFoundError('Project', projectId)
      }

      const now = new Date().toISOString()
      const id = uuid()

      db.prepare(`
        INSERT INTO missions (id, project_id, name, status, draft_content, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, projectId, name, MissionStatus.DRAFT, draftContent, now, now)

      const row = db.prepare('SELECT * FROM missions WHERE id = ?').get(id) as MissionRow
      const mission = rowToMission(row)

      res.status(201).json({ success: true, data: mission })
    } catch (error) {
      next(error)
    }
  })

  // GET /api/missions/:id - Get mission
  router.get('/:id', (req: Request, res: Response<ApiResponse<Mission>>, next: NextFunction) => {
    try {
      const { id } = req.params
      const db = getDatabase()
      const row = db.prepare('SELECT * FROM missions WHERE id = ?').get(id) as MissionRow | undefined

      if (!row) {
        throw new NotFoundError('Mission', id ?? 'unknown')
      }

      const mission = rowToMission(row)
      res.json({ success: true, data: mission })
    } catch (error) {
      next(error)
    }
  })

  // PATCH /api/missions/:id - Update mission
  router.patch('/:id', (req: Request, res: Response<ApiResponse<Mission>>, next: NextFunction) => {
    try {
      const { id } = req.params
      const parsed = updateMissionSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new ValidationError('Invalid input', parsed.error.errors)
      }

      const db = getDatabase()
      const existing = db.prepare('SELECT * FROM missions WHERE id = ?').get(id) as MissionRow | undefined

      if (!existing) {
        throw new NotFoundError('Mission', id ?? 'unknown')
      }

      const { name, draftContent, prdContent, status } = parsed.data
      const updates: string[] = []
      const values: (string | number)[] = []

      if (name !== undefined) {
        updates.push('name = ?')
        values.push(name)
      }
      if (draftContent !== undefined) {
        updates.push('draft_content = ?')
        values.push(draftContent)
      }
      if (prdContent !== undefined) {
        updates.push('prd_content = ?')
        values.push(prdContent)
      }
      if (status !== undefined) {
        const currentStatus = existing.status as MissionStatus
        if (!canTransition(currentStatus, status)) {
          throw new AppError(400, 'INVALID_TRANSITION', `Cannot transition from ${currentStatus} to ${status}`)
        }
        updates.push('status = ?')
        values.push(status)
      }

      if (updates.length > 0) {
        updates.push('updated_at = ?')
        values.push(new Date().toISOString())
        values.push(id!)

        db.prepare(`UPDATE missions SET ${updates.join(', ')} WHERE id = ?`).run(...values)
      }

      const row = db.prepare('SELECT * FROM missions WHERE id = ?').get(id) as MissionRow
      const mission = rowToMission(row)

      res.json({ success: true, data: mission })
    } catch (error) {
      next(error)
    }
  })

  // DELETE /api/missions/:id - Delete mission
  router.delete('/:id', (req: Request, res: Response<ApiResponse<{ success: boolean }>>, next: NextFunction) => {
    try {
      const { id } = req.params
      const db = getDatabase()
      const existing = db.prepare('SELECT * FROM missions WHERE id = ?').get(id)

      if (!existing) {
        throw new NotFoundError('Mission', id ?? 'unknown')
      }

      db.prepare('DELETE FROM missions WHERE id = ?').run(id)

      res.json({ success: true, data: { success: true } })
    } catch (error) {
      next(error)
    }
  })

  // POST /api/missions/:id/generate-prd - Generate PRD from draft
  router.post('/:id/generate-prd', (req: Request, res: Response<ApiResponse<Mission>>, next: NextFunction) => {
    try {
      const { id } = req.params
      const db = getDatabase()
      const existing = db.prepare('SELECT * FROM missions WHERE id = ?').get(id) as MissionRow | undefined

      if (!existing) {
        throw new NotFoundError('Mission', id ?? 'unknown')
      }

      const currentStatus = existing.status as MissionStatus
      if (!canTransition(currentStatus, MissionStatus.GENERATING_PRD)) {
        throw new AppError(400, 'INVALID_TRANSITION', `Cannot generate PRD from ${currentStatus} status`)
      }

      const now = new Date().toISOString()
      db.prepare(`
        UPDATE missions SET status = ?, prd_iterations = prd_iterations + 1, updated_at = ? WHERE id = ?
      `).run(MissionStatus.GENERATING_PRD, now, id)

      const row = db.prepare('SELECT * FROM missions WHERE id = ?').get(id) as MissionRow
      const mission = rowToMission(row)

      // Note: Actual PRD generation would be triggered by MissionExecutor service
      res.json({ success: true, data: mission })
    } catch (error) {
      next(error)
    }
  })

  // POST /api/missions/:id/generate-tasks - Generate tasks from PRD
  router.post('/:id/generate-tasks', (req: Request, res: Response<ApiResponse<Mission>>, next: NextFunction) => {
    try {
      const { id } = req.params
      const db = getDatabase()
      const existing = db.prepare('SELECT * FROM missions WHERE id = ?').get(id) as MissionRow | undefined

      if (!existing) {
        throw new NotFoundError('Mission', id ?? 'unknown')
      }

      const currentStatus = existing.status as MissionStatus
      if (currentStatus !== MissionStatus.PRD_REVIEW) {
        throw new AppError(400, 'INVALID_TRANSITION', `Cannot generate tasks from ${currentStatus} status`)
      }

      const now = new Date().toISOString()
      db.prepare(`
        UPDATE missions SET status = ?, tasks_iterations = tasks_iterations + 1, updated_at = ? WHERE id = ?
      `).run(MissionStatus.PREPARING_TASKS, now, id)

      const row = db.prepare('SELECT * FROM missions WHERE id = ?').get(id) as MissionRow
      const mission = rowToMission(row)

      // Note: Actual task generation would be triggered by MissionExecutor service
      res.json({ success: true, data: mission })
    } catch (error) {
      next(error)
    }
  })

  // POST /api/missions/:id/start - Start mission execution
  router.post('/:id/start', (req: Request, res: Response<ApiResponse<Mission>>, next: NextFunction) => {
    try {
      const { id } = req.params
      const db = getDatabase()
      const existing = db.prepare('SELECT * FROM missions WHERE id = ?').get(id) as MissionRow | undefined

      if (!existing) {
        throw new NotFoundError('Mission', id ?? 'unknown')
      }

      const currentStatus = existing.status as MissionStatus
      if (currentStatus !== MissionStatus.TASKS_REVIEW) {
        throw new AppError(400, 'INVALID_TRANSITION', `Cannot start mission from ${currentStatus} status`)
      }

      const now = new Date().toISOString()
      db.prepare(`
        UPDATE missions SET status = ?, started_at = ?, updated_at = ? WHERE id = ?
      `).run(MissionStatus.IN_PROGRESS, now, now, id)

      const row = db.prepare('SELECT * FROM missions WHERE id = ?').get(id) as MissionRow
      const mission = rowToMission(row)

      // Note: Actual mission execution would be triggered by MissionExecutor service
      res.json({ success: true, data: mission })
    } catch (error) {
      next(error)
    }
  })

  // POST /api/missions/:id/stop - Stop mission execution
  router.post('/:id/stop', (req: Request, res: Response<ApiResponse<Mission>>, next: NextFunction) => {
    try {
      const { id } = req.params
      const db = getDatabase()
      const existing = db.prepare('SELECT * FROM missions WHERE id = ?').get(id) as MissionRow | undefined

      if (!existing) {
        throw new NotFoundError('Mission', id ?? 'unknown')
      }

      const currentStatus = existing.status as MissionStatus
      if (currentStatus !== MissionStatus.IN_PROGRESS && currentStatus !== MissionStatus.GENERATING_PRD && currentStatus !== MissionStatus.PREPARING_TASKS) {
        throw new AppError(400, 'INVALID_TRANSITION', `Cannot stop mission from ${currentStatus} status`)
      }

      const now = new Date().toISOString()
      db.prepare(`
        UPDATE missions SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?
      `).run(MissionStatus.COMPLETED_FAILED, now, now, id)

      const row = db.prepare('SELECT * FROM missions WHERE id = ?').get(id) as MissionRow
      const mission = rowToMission(row)

      // Note: Actual process termination would be handled by Orchestrator service
      res.json({ success: true, data: mission })
    } catch (error) {
      next(error)
    }
  })

  return router
}
