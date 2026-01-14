import { Router } from 'express'
import { createProjectsRouter } from './projects.js'
import { createMissionsRouter } from './missions.js'
import { createTasksRouter } from './tasks.js'
import { createLogsRouter } from './logs.js'

export function createRouter(): Router {
  const router = Router()

  router.use('/projects', createProjectsRouter())
  router.use('/missions', createMissionsRouter())
  router.use('/tasks', createTasksRouter())
  router.use('/logs', createLogsRouter())

  return router
}
