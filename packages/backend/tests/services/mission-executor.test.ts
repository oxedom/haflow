import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MissionExecutor, getMissionExecutor, resetMissionExecutor } from '../../src/services/mission-executor.js'
import { setDatabase, resetDatabase } from '../../src/database/connection.js'
import { getTestDatabase } from '../setup.js'
import { MissionStatus, TaskStatus } from '@ralphy/shared'
import { v4 as uuid } from 'uuid'

// Mock the orchestrator
vi.mock('../../src/services/orchestrator.js', () => {
  return {
    getOrchestrator: vi.fn(() => ({
      spawn: vi.fn((options) => {
        // Simulate successful execution
        setTimeout(() => {
          if (options.onStdout) {
            options.onStdout('Mock output')
          }
          if (options.onExit) {
            options.onExit(0)
          }
        }, 10)

        return {
          pid: 12345,
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          on: vi.fn()
        }
      }),
      kill: vi.fn(() => true),
      isRunning: vi.fn(() => false)
    }))
  }
})

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn()
}))

describe('MissionExecutor', () => {
  let executor: MissionExecutor
  let projectId: string
  let missionId: string

  beforeEach(() => {
    const db = getTestDatabase()
    setDatabase(db)
    executor = new MissionExecutor()

    // Create test data
    const now = new Date().toISOString()
    projectId = uuid()
    missionId = uuid()

    db.prepare(`
      INSERT INTO projects (id, name, path, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(projectId, 'Test Project', '/test/path', now, now)

    db.prepare(`
      INSERT INTO missions (id, project_id, name, status, draft_content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(missionId, projectId, 'Test Mission', MissionStatus.DRAFT, 'Test draft content', now, now)
  })

  afterEach(() => {
    resetDatabase()
    resetMissionExecutor()
  })

  describe('generatePRD', () => {
    it('should throw error for non-existent mission', async () => {
      await expect(executor.generatePRD('nonexistent')).rejects.toThrow('Mission not found')
    })

    it('should generate PRD and update mission status', async () => {
      const db = getTestDatabase()

      // Update status to generating_prd first
      db.prepare('UPDATE missions SET status = ? WHERE id = ?')
        .run(MissionStatus.GENERATING_PRD, missionId)

      await executor.generatePRD(missionId)

      const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(missionId) as any
      expect(mission.status).toBe(MissionStatus.PRD_REVIEW)
      expect(mission.prd_content).toBe('Mock output')
    })
  })

  describe('generateTasks', () => {
    it('should throw error when PRD content is missing', async () => {
      const db = getTestDatabase()
      db.prepare('UPDATE missions SET status = ? WHERE id = ?')
        .run(MissionStatus.PREPARING_TASKS, missionId)

      await expect(executor.generateTasks(missionId)).rejects.toThrow('PRD content is required')
    })
  })

  describe('isActive', () => {
    it('should return false for inactive mission', () => {
      expect(executor.isActive(missionId)).toBe(false)
    })
  })
})

describe('Singleton functions', () => {
  beforeEach(() => {
    setDatabase(getTestDatabase())
  })

  afterEach(() => {
    resetDatabase()
    resetMissionExecutor()
  })

  it('should return same instance from getMissionExecutor', () => {
    const instance1 = getMissionExecutor()
    const instance2 = getMissionExecutor()
    expect(instance1).toBe(instance2)
  })

  it('should create new instance after reset', () => {
    const instance1 = getMissionExecutor()
    resetMissionExecutor()
    const instance2 = getMissionExecutor()
    expect(instance1).not.toBe(instance2)
  })
})
