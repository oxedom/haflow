import { describe, it, expect, vi, beforeEach } from 'vitest'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { getTestDir } from '../setup.js'

describe('link command', () => {
  let projectDir: string

  beforeEach(async () => {
    const { initCommand } = await import('../../src/commands/init.js')
    await initCommand({ force: false })

    projectDir = join(getTestDir(), 'test-project')
    mkdirSync(projectDir, { recursive: true })
  })

  it('creates .ralphy directory in project', async () => {
    const { linkCommand } = await import('../../src/commands/link.js')
    const { getProjectRalphyDir } = await import('../../src/lib/paths.js')

    const result = await linkCommand(projectDir, {})

    expect(result.success).toBe(true)
    expect(result.projectId).toBeDefined()
    expect(existsSync(getProjectRalphyDir(projectDir))).toBe(true)
  })

  it('registers project in database', async () => {
    const { linkCommand } = await import('../../src/commands/link.js')
    const { getCliDatabase, closeCliDatabase } = await import('../../src/lib/database.js')

    const result = await linkCommand(projectDir, {})

    expect(result.success).toBe(true)

    const db = getCliDatabase()
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.projectId)
    closeCliDatabase()

    expect(project).toBeDefined()
  })

  it('uses custom name from --name option', async () => {
    const { linkCommand } = await import('../../src/commands/link.js')
    const { getCliDatabase, closeCliDatabase } = await import('../../src/lib/database.js')

    const result = await linkCommand(projectDir, { name: 'custom-name' })

    expect(result.success).toBe(true)

    const db = getCliDatabase()
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.projectId) as { name: string }
    closeCliDatabase()

    expect(project.name).toBe('custom-name')
  })

  it('returns alreadyLinked for existing project', async () => {
    const { linkCommand } = await import('../../src/commands/link.js')

    await linkCommand(projectDir, {})
    const result = await linkCommand(projectDir, {})

    expect(result.success).toBe(true)
    expect(result.alreadyLinked).toBe(true)
  })

  it('fails when Ralphy not initialized', async () => {
    // Create fresh test directory without init
    vi.stubEnv('RALPHY_HOME', '/nonexistent/ralphy/path')
    vi.resetModules()

    const { linkCommand: freshLinkCommand } = await import('../../src/commands/link.js')
    const result = await freshLinkCommand(projectDir, {})

    expect(result.success).toBe(false)
    expect(result.error).toBe('Ralphy not initialized')
  })

  it('fails for non-existent directory', async () => {
    const { linkCommand } = await import('../../src/commands/link.js')

    const result = await linkCommand('/nonexistent/path', {})

    expect(result.success).toBe(false)
    expect(result.error).toBe('Directory does not exist')
  })
})
