import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/server.js'
import { setDatabase, resetDatabase } from '../../src/database/connection.js'
import { getTestDatabase } from '../setup.js'
import { MissionStatus } from '@ralphy/shared'
import type { Express } from 'express'

describe('Missions Routes', () => {
  let app: Express
  let projectId: string

  beforeEach(async () => {
    setDatabase(getTestDatabase())
    app = createApp({ enableLogging: false })

    // Create a project for missions
    const projectRes = await request(app)
      .post('/api/projects')
      .send({ name: 'Test Project', path: '/test/path' })

    projectId = projectRes.body.data.id
  })

  afterEach(() => {
    resetDatabase()
  })

  describe('GET /api/missions', () => {
    it('should return empty array when no missions exist', async () => {
      const res = await request(app).get('/api/missions')

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ success: true, data: [] })
    })

    it('should filter missions by projectId', async () => {
      await request(app)
        .post('/api/missions')
        .send({ projectId, name: 'Mission 1', draftContent: 'content' })

      const res = await request(app).get(`/api/missions?projectId=${projectId}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
    })
  })

  describe('POST /api/missions', () => {
    it('should create a new mission', async () => {
      const res = await request(app)
        .post('/api/missions')
        .send({
          projectId,
          name: 'New Mission',
          draftContent: 'This is the draft content'
        })

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.name).toBe('New Mission')
      expect(res.body.data.status).toBe(MissionStatus.DRAFT)
      expect(res.body.data.draftContent).toBe('This is the draft content')
    })

    it('should return 404 for non-existent project', async () => {
      const res = await request(app)
        .post('/api/missions')
        .send({
          projectId: 'nonexistent',
          name: 'Mission',
          draftContent: 'content'
        })

      expect(res.status).toBe(404)
    })

    it('should return 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/missions')
        .send({ projectId })

      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/missions/:id', () => {
    it('should return a mission by id', async () => {
      const createRes = await request(app)
        .post('/api/missions')
        .send({ projectId, name: 'Test Mission', draftContent: 'content' })

      const missionId = createRes.body.data.id

      const res = await request(app).get(`/api/missions/${missionId}`)

      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(missionId)
    })

    it('should return 404 for non-existent mission', async () => {
      const res = await request(app).get('/api/missions/nonexistent')

      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /api/missions/:id', () => {
    it('should update mission name', async () => {
      const createRes = await request(app)
        .post('/api/missions')
        .send({ projectId, name: 'Original', draftContent: 'content' })

      const missionId = createRes.body.data.id

      const res = await request(app)
        .patch(`/api/missions/${missionId}`)
        .send({ name: 'Updated' })

      expect(res.status).toBe(200)
      expect(res.body.data.name).toBe('Updated')
    })

    it('should reject invalid status transition', async () => {
      const createRes = await request(app)
        .post('/api/missions')
        .send({ projectId, name: 'Mission', draftContent: 'content' })

      const missionId = createRes.body.data.id

      // Try to go directly from draft to in_progress (invalid)
      const res = await request(app)
        .patch(`/api/missions/${missionId}`)
        .send({ status: MissionStatus.IN_PROGRESS })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('INVALID_TRANSITION')
    })
  })

  describe('Mission Actions', () => {
    describe('POST /api/missions/:id/generate-prd', () => {
      it('should transition from draft to generating_prd', async () => {
        const createRes = await request(app)
          .post('/api/missions')
          .send({ projectId, name: 'Mission', draftContent: 'content' })

        const missionId = createRes.body.data.id

        const res = await request(app).post(`/api/missions/${missionId}/generate-prd`)

        expect(res.status).toBe(200)
        expect(res.body.data.status).toBe(MissionStatus.GENERATING_PRD)
        expect(res.body.data.prdIterations).toBe(1)
      })

      it('should reject if not in draft status', async () => {
        const createRes = await request(app)
          .post('/api/missions')
          .send({ projectId, name: 'Mission', draftContent: 'content' })

        const missionId = createRes.body.data.id

        // First call succeeds
        await request(app).post(`/api/missions/${missionId}/generate-prd`)

        // Second call from generating_prd status should fail
        const res = await request(app).post(`/api/missions/${missionId}/generate-prd`)

        expect(res.status).toBe(400)
      })
    })

    describe('POST /api/missions/:id/start', () => {
      it('should reject if not in tasks_review status', async () => {
        const createRes = await request(app)
          .post('/api/missions')
          .send({ projectId, name: 'Mission', draftContent: 'content' })

        const missionId = createRes.body.data.id

        const res = await request(app).post(`/api/missions/${missionId}/start`)

        expect(res.status).toBe(400)
      })
    })
  })

  describe('DELETE /api/missions/:id', () => {
    it('should delete a mission', async () => {
      const createRes = await request(app)
        .post('/api/missions')
        .send({ projectId, name: 'To Delete', draftContent: 'content' })

      const missionId = createRes.body.data.id

      const res = await request(app).delete(`/api/missions/${missionId}`)

      expect(res.status).toBe(200)

      const getRes = await request(app).get(`/api/missions/${missionId}`)
      expect(getRes.status).toBe(404)
    })
  })
})
