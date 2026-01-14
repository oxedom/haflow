import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { v4 as uuid } from 'uuid'
import { createApp } from '../../src/server.js'
import { setDatabase, resetDatabase } from '../../src/database/connection.js'
import { getTestDatabase } from '../setup.js'
import { TaskStatus } from '@ralphy/shared'
import type { Express } from 'express'

describe('Tasks Routes', () => {
  let app: Express
  let projectId: string
  let missionId: string

  beforeEach(async () => {
    setDatabase(getTestDatabase())
    app = createApp({ enableLogging: false })

    // Create project and mission
    const projectRes = await request(app)
      .post('/api/projects')
      .send({ name: 'Test Project', path: '/test/path' })

    projectId = projectRes.body.data.id

    const missionRes = await request(app)
      .post('/api/missions')
      .send({ projectId, name: 'Test Mission', draftContent: 'content' })

    missionId = missionRes.body.data.id

    // Create some tasks directly in the database
    const db = getTestDatabase()
    const taskId1 = uuid()
    const taskId2 = uuid()

    db.prepare(`
      INSERT INTO tasks (id, mission_id, category, description, order_num, status, agents, skills, steps_to_verify)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(taskId1, missionId, 'setup', 'Set up environment', 1, TaskStatus.PENDING, '["agent1"]', '["skill1"]', '["step1"]')

    db.prepare(`
      INSERT INTO tasks (id, mission_id, category, description, order_num, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(taskId2, missionId, 'implementation', 'Implement feature', 2, TaskStatus.PENDING)
  })

  afterEach(() => {
    resetDatabase()
  })

  describe('GET /api/tasks', () => {
    it('should return 400 when missionId is missing', async () => {
      const res = await request(app).get('/api/tasks')

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return tasks for a mission', async () => {
      const res = await request(app).get(`/api/tasks?missionId=${missionId}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(2)
      expect(res.body.data[0].order).toBe(1)
      expect(res.body.data[1].order).toBe(2)
    })

    it('should parse JSON arrays correctly', async () => {
      const res = await request(app).get(`/api/tasks?missionId=${missionId}`)

      expect(res.body.data[0].agents).toEqual(['agent1'])
      expect(res.body.data[0].skills).toEqual(['skill1'])
      expect(res.body.data[0].stepsToVerify).toEqual(['step1'])
    })

    it('should return empty arrays for null JSON fields', async () => {
      const res = await request(app).get(`/api/tasks?missionId=${missionId}`)

      expect(res.body.data[1].agents).toEqual([])
      expect(res.body.data[1].skills).toEqual([])
    })
  })

  describe('GET /api/tasks/:id', () => {
    it('should return a task by id', async () => {
      const listRes = await request(app).get(`/api/tasks?missionId=${missionId}`)
      const taskId = listRes.body.data[0].id

      const res = await request(app).get(`/api/tasks/${taskId}`)

      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(taskId)
      expect(res.body.data.category).toBe('setup')
    })

    it('should return 404 for non-existent task', async () => {
      const res = await request(app).get('/api/tasks/nonexistent')

      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /api/tasks/:id', () => {
    it('should update task status', async () => {
      const listRes = await request(app).get(`/api/tasks?missionId=${missionId}`)
      const taskId = listRes.body.data[0].id

      const res = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .send({ status: TaskStatus.IN_PROGRESS })

      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe(TaskStatus.IN_PROGRESS)
    })

    it('should update task output', async () => {
      const listRes = await request(app).get(`/api/tasks?missionId=${missionId}`)
      const taskId = listRes.body.data[0].id

      const res = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .send({ output: 'Task completed successfully' })

      expect(res.status).toBe(200)
      expect(res.body.data.output).toBe('Task completed successfully')
    })

    it('should update task passes', async () => {
      const listRes = await request(app).get(`/api/tasks?missionId=${missionId}`)
      const taskId = listRes.body.data[0].id

      const res = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .send({ passes: 3 })

      expect(res.status).toBe(200)
      expect(res.body.data.passes).toBe(3)
    })

    it('should return 404 for non-existent task', async () => {
      const res = await request(app)
        .patch('/api/tasks/nonexistent')
        .send({ status: TaskStatus.COMPLETED })

      expect(res.status).toBe(404)
    })

    it('should return 400 for invalid status', async () => {
      const listRes = await request(app).get(`/api/tasks?missionId=${missionId}`)
      const taskId = listRes.body.data[0].id

      const res = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .send({ status: 'invalid_status' })

      expect(res.status).toBe(400)
    })
  })
})
