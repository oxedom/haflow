import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { v4 as uuid } from 'uuid'
import type { Project, ApiResponse } from '@ralphy/shared'
import { getDatabase } from '../database/connection.js'
import { NotFoundError, ValidationError } from '../middleware/error-handler.js'

const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  path: z.string().min(1, 'Path is required')
})

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional()
})

interface ProjectRow {
  id: string
  name: string
  path: string
  is_active: number
  created_at: string
  updated_at: string
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function createProjectsRouter(): Router {
  const router = Router()

  // GET /api/projects - List all projects
  router.get('/', (_req: Request, res: Response<ApiResponse<Project[]>>, next: NextFunction) => {
    try {
      const db = getDatabase()
      const rows = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as ProjectRow[]
      const projects = rows.map(rowToProject)

      res.json({ success: true, data: projects })
    } catch (error) {
      next(error)
    }
  })

  // POST /api/projects - Create project
  router.post('/', (req: Request, res: Response<ApiResponse<Project>>, next: NextFunction) => {
    try {
      const parsed = createProjectSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new ValidationError('Invalid input', parsed.error.errors)
      }

      const { name, path } = parsed.data
      const db = getDatabase()
      const now = new Date().toISOString()
      const id = uuid()

      db.prepare(`
        INSERT INTO projects (id, name, path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, name, path, now, now)

      const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow
      const project = rowToProject(row)

      res.status(201).json({ success: true, data: project })
    } catch (error) {
      next(error)
    }
  })

  // GET /api/projects/:id - Get project
  router.get('/:id', (req: Request, res: Response<ApiResponse<Project>>, next: NextFunction) => {
    try {
      const { id } = req.params
      const db = getDatabase()
      const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined

      if (!row) {
        throw new NotFoundError('Project', id ?? 'unknown')
      }

      const project = rowToProject(row)
      res.json({ success: true, data: project })
    } catch (error) {
      next(error)
    }
  })

  // PATCH /api/projects/:id - Update project
  router.patch('/:id', (req: Request, res: Response<ApiResponse<Project>>, next: NextFunction) => {
    try {
      const { id } = req.params
      const parsed = updateProjectSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new ValidationError('Invalid input', parsed.error.errors)
      }

      const db = getDatabase()
      const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined

      if (!existing) {
        throw new NotFoundError('Project', id ?? 'unknown')
      }

      const { name, isActive } = parsed.data
      const updates: string[] = []
      const values: (string | number)[] = []

      if (name !== undefined) {
        updates.push('name = ?')
        values.push(name)
      }
      if (isActive !== undefined) {
        updates.push('is_active = ?')
        values.push(isActive ? 1 : 0)
      }

      if (updates.length > 0) {
        updates.push('updated_at = ?')
        values.push(new Date().toISOString())
        values.push(id!)

        db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values)
      }

      const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow
      const project = rowToProject(row)

      res.json({ success: true, data: project })
    } catch (error) {
      next(error)
    }
  })

  // DELETE /api/projects/:id - Delete project
  router.delete('/:id', (req: Request, res: Response<ApiResponse<{ success: boolean }>>, next: NextFunction) => {
    try {
      const { id } = req.params
      const db = getDatabase()
      const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id)

      if (!existing) {
        throw new NotFoundError('Project', id ?? 'unknown')
      }

      db.prepare('DELETE FROM projects WHERE id = ?').run(id)

      res.json({ success: true, data: { success: true } })
    } catch (error) {
      next(error)
    }
  })

  return router
}
