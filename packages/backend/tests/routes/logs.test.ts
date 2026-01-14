import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { v4 as uuid } from 'uuid'
import { createApp } from '../../src/server.js'
import { setDatabase, resetDatabase } from '../../src/database/connection.js'
import { getTestDatabase } from '../setup.js'
import { LogLevel } from '@ralphy/shared'
import type { Express } from 'express'

describe('Logs Routes', () => {
  let app: Express
  let missionId: string

  beforeEach(async () => {
    setDatabase(getTestDatabase())
    app = createApp({ enableLogging: false })

    // Create project and mission
    const projectRes = await request(app)
      .post('/api/projects')
      .send({ name: 'Test Project', path: '/test/path' })

    const projectId = projectRes.body.data.id

    const missionRes = await request(app)
      .post('/api/missions')
      .send({ projectId, name: 'Test Mission', draftContent: 'content' })

    missionId = missionRes.body.data.id

    // Create some logs directly in the database
    const db = getTestDatabase()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO logs (id, mission_id, level, message, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuid(), missionId, LogLevel.INFO, 'Info message', now, JSON.stringify({ key: 'value' }))

    db.prepare(`
      INSERT INTO logs (id, mission_id, level, message, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuid(), missionId, LogLevel.ERROR, 'Error message', now)

    db.prepare(`
      INSERT INTO logs (id, mission_id, level, message, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuid(), missionId, LogLevel.DEBUG, 'Debug message', now)
  })

  afterEach(() => {
    resetDatabase()
  })

  describe('GET /api/logs', () => {
    it('should return 400 when missionId is missing', async () => {
      const res = await request(app).get('/api/logs')

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return logs for a mission', async () => {
      const res = await request(app).get(`/api/logs?missionId=${missionId}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(3)
    })

    it('should filter logs by level', async () => {
      const res = await request(app).get(`/api/logs?missionId=${missionId}&level=${LogLevel.ERROR}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].level).toBe(LogLevel.ERROR)
    })

    it('should limit results', async () => {
      const res = await request(app).get(`/api/logs?missionId=${missionId}&limit=2`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(2)
    })

    it('should parse JSON metadata correctly', async () => {
      const res = await request(app).get(`/api/logs?missionId=${missionId}&level=${LogLevel.INFO}`)

      expect(res.body.data[0].metadata).toEqual({ key: 'value' })
    })

    it('should return null for missing metadata', async () => {
      const res = await request(app).get(`/api/logs?missionId=${missionId}&level=${LogLevel.ERROR}`)

      expect(res.body.data[0].metadata).toBeNull()
    })

    it('should return 400 for invalid log level', async () => {
      const res = await request(app).get(`/api/logs?missionId=${missionId}&level=invalid`)

      expect(res.status).toBe(400)
    })
  })
})
