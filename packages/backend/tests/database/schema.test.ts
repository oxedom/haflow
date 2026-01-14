import { describe, it, expect } from 'vitest'
import { getTestDatabase } from '../setup.js'

describe('Database Schema', () => {
  describe('projects table', () => {
    it('should create projects table with correct columns', () => {
      const db = getTestDatabase()
      const tableInfo = db.prepare("PRAGMA table_info('projects')").all() as Array<{
        name: string
        type: string
        notnull: number
        pk: number
      }>

      const columns = tableInfo.map((col) => col.name)
      expect(columns).toContain('id')
      expect(columns).toContain('name')
      expect(columns).toContain('path')
      expect(columns).toContain('is_active')
      expect(columns).toContain('created_at')
      expect(columns).toContain('updated_at')
    })

    it('should enforce unique path constraint', () => {
      const db = getTestDatabase()
      const now = new Date().toISOString()

      db.prepare(`
        INSERT INTO projects (id, name, path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('1', 'Project 1', '/path/to/project', now, now)

      expect(() => {
        db.prepare(`
          INSERT INTO projects (id, name, path, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `).run('2', 'Project 2', '/path/to/project', now, now)
      }).toThrow()
    })
  })

  describe('missions table', () => {
    it('should create missions table with correct columns', () => {
      const db = getTestDatabase()
      const tableInfo = db.prepare("PRAGMA table_info('missions')").all() as Array<{
        name: string
      }>

      const columns = tableInfo.map((col) => col.name)
      expect(columns).toContain('id')
      expect(columns).toContain('project_id')
      expect(columns).toContain('name')
      expect(columns).toContain('status')
      expect(columns).toContain('branch_name')
      expect(columns).toContain('draft_content')
      expect(columns).toContain('prd_content')
      expect(columns).toContain('prd_iterations')
      expect(columns).toContain('tasks_iterations')
    })

    it('should enforce foreign key constraint to projects', () => {
      const db = getTestDatabase()
      const now = new Date().toISOString()

      expect(() => {
        db.prepare(`
          INSERT INTO missions (id, project_id, name, status, draft_content, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run('1', 'nonexistent', 'Mission 1', 'draft', 'content', now, now)
      }).toThrow()
    })
  })

  describe('tasks table', () => {
    it('should create tasks table with correct columns', () => {
      const db = getTestDatabase()
      const tableInfo = db.prepare("PRAGMA table_info('tasks')").all() as Array<{
        name: string
      }>

      const columns = tableInfo.map((col) => col.name)
      expect(columns).toContain('id')
      expect(columns).toContain('mission_id')
      expect(columns).toContain('category')
      expect(columns).toContain('description')
      expect(columns).toContain('order_num')
      expect(columns).toContain('status')
      expect(columns).toContain('agents')
      expect(columns).toContain('skills')
      expect(columns).toContain('steps_to_verify')
      expect(columns).toContain('passes')
      expect(columns).toContain('output')
    })
  })

  describe('logs table', () => {
    it('should create logs table with correct columns', () => {
      const db = getTestDatabase()
      const tableInfo = db.prepare("PRAGMA table_info('logs')").all() as Array<{
        name: string
      }>

      const columns = tableInfo.map((col) => col.name)
      expect(columns).toContain('id')
      expect(columns).toContain('mission_id')
      expect(columns).toContain('level')
      expect(columns).toContain('message')
      expect(columns).toContain('timestamp')
      expect(columns).toContain('metadata')
    })
  })

  describe('JSON columns', () => {
    it('should serialize and deserialize JSON correctly in tasks', () => {
      const db = getTestDatabase()
      const now = new Date().toISOString()

      // Create a project first
      db.prepare(`
        INSERT INTO projects (id, name, path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('proj-1', 'Test Project', '/test/path', now, now)

      // Create a mission
      db.prepare(`
        INSERT INTO missions (id, project_id, name, status, draft_content, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('mission-1', 'proj-1', 'Test Mission', 'draft', 'content', now, now)

      const agents = ['agent1', 'agent2']
      const skills = ['skill1', 'skill2']
      const steps = ['step1', 'step2']

      // Insert task with JSON data
      db.prepare(`
        INSERT INTO tasks (id, mission_id, category, description, order_num, status, agents, skills, steps_to_verify)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('task-1', 'mission-1', 'test', 'description', 1, 'pending', JSON.stringify(agents), JSON.stringify(skills), JSON.stringify(steps))

      // Read back
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get('task-1') as {
        agents: string
        skills: string
        steps_to_verify: string
      }

      expect(JSON.parse(task.agents)).toEqual(agents)
      expect(JSON.parse(task.skills)).toEqual(skills)
      expect(JSON.parse(task.steps_to_verify)).toEqual(steps)
    })

    it('should serialize and deserialize JSON correctly in logs', () => {
      const db = getTestDatabase()
      const now = new Date().toISOString()

      // Create project and mission first
      db.prepare(`
        INSERT INTO projects (id, name, path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('proj-1', 'Test Project', '/test/path', now, now)

      db.prepare(`
        INSERT INTO missions (id, project_id, name, status, draft_content, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('mission-1', 'proj-1', 'Test Mission', 'draft', 'content', now, now)

      const metadata = { key: 'value', count: 42 }

      // Insert log with JSON metadata
      db.prepare(`
        INSERT INTO logs (id, mission_id, level, message, timestamp, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('log-1', 'mission-1', 'info', 'test message', now, JSON.stringify(metadata))

      // Read back
      const log = db.prepare('SELECT * FROM logs WHERE id = ?').get('log-1') as {
        metadata: string
      }

      expect(JSON.parse(log.metadata)).toEqual(metadata)
    })
  })
})
