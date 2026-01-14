import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/server.js'
import { setDatabase, resetDatabase } from '../../src/database/connection.js'
import { getTestDatabase } from '../setup.js'
import type { Express } from 'express'

describe('Projects Routes', () => {
  let app: Express

  beforeEach(() => {
    setDatabase(getTestDatabase())
    app = createApp({ enableLogging: false })
  })

  afterEach(() => {
    resetDatabase()
  })

  describe('GET /api/projects', () => {
    it('should return empty array when no projects exist', async () => {
      const res = await request(app).get('/api/projects')

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ success: true, data: [] })
    })

    it('should return all projects', async () => {
      // Create a project first
      await request(app)
        .post('/api/projects')
        .send({ name: 'Test Project', path: '/test/path' })

      const res = await request(app).get('/api/projects')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].name).toBe('Test Project')
    })
  })

  describe('POST /api/projects', () => {
    it('should create a new project', async () => {
      const res = await request(app)
        .post('/api/projects')
        .send({ name: 'New Project', path: '/new/path' })

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.name).toBe('New Project')
      expect(res.body.data.path).toBe('/new/path')
      expect(res.body.data.isActive).toBe(true)
      expect(res.body.data.id).toBeDefined()
    })

    it('should return 400 for missing name', async () => {
      const res = await request(app)
        .post('/api/projects')
        .send({ path: '/test/path' })

      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for missing path', async () => {
      const res = await request(app)
        .post('/api/projects')
        .send({ name: 'Test' })

      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
    })

    it('should return 409 for duplicate path', async () => {
      await request(app)
        .post('/api/projects')
        .send({ name: 'Project 1', path: '/same/path' })

      const res = await request(app)
        .post('/api/projects')
        .send({ name: 'Project 2', path: '/same/path' })

      expect(res.status).toBe(409)
      expect(res.body.success).toBe(false)
      expect(res.body.error.code).toBe('CONFLICT')
    })
  })

  describe('GET /api/projects/:id', () => {
    it('should return a project by id', async () => {
      const createRes = await request(app)
        .post('/api/projects')
        .send({ name: 'Test Project', path: '/test/path' })

      const projectId = createRes.body.data.id

      const res = await request(app).get(`/api/projects/${projectId}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.id).toBe(projectId)
      expect(res.body.data.name).toBe('Test Project')
    })

    it('should return 404 for non-existent project', async () => {
      const res = await request(app).get('/api/projects/nonexistent')

      expect(res.status).toBe(404)
      expect(res.body.success).toBe(false)
      expect(res.body.error.code).toBe('NOT_FOUND')
    })
  })

  describe('PATCH /api/projects/:id', () => {
    it('should update project name', async () => {
      const createRes = await request(app)
        .post('/api/projects')
        .send({ name: 'Original Name', path: '/test/path' })

      const projectId = createRes.body.data.id

      const res = await request(app)
        .patch(`/api/projects/${projectId}`)
        .send({ name: 'Updated Name' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.name).toBe('Updated Name')
    })

    it('should update project isActive', async () => {
      const createRes = await request(app)
        .post('/api/projects')
        .send({ name: 'Test Project', path: '/test/path' })

      const projectId = createRes.body.data.id

      const res = await request(app)
        .patch(`/api/projects/${projectId}`)
        .send({ isActive: false })

      expect(res.status).toBe(200)
      expect(res.body.data.isActive).toBe(false)
    })

    it('should return 404 for non-existent project', async () => {
      const res = await request(app)
        .patch('/api/projects/nonexistent')
        .send({ name: 'Test' })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/projects/:id', () => {
    it('should delete a project', async () => {
      const createRes = await request(app)
        .post('/api/projects')
        .send({ name: 'To Delete', path: '/delete/path' })

      const projectId = createRes.body.data.id

      const res = await request(app).delete(`/api/projects/${projectId}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)

      // Verify deletion
      const getRes = await request(app).get(`/api/projects/${projectId}`)
      expect(getRes.status).toBe(404)
    })

    it('should return 404 for non-existent project', async () => {
      const res = await request(app).delete('/api/projects/nonexistent')

      expect(res.status).toBe(404)
    })
  })
})
