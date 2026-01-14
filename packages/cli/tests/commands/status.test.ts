import { describe, it, expect, beforeEach } from 'vitest'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { getTestDir } from '../setup.js'

describe('status command', () => {
  it('shows not initialized when Ralphy not initialized', async () => {
    const { statusCommand } = await import('../../src/commands/status.js')

    const status = await statusCommand({ json: true })

    expect(status.initialized).toBe(false)
    expect(status.ralphyHome).toBeNull()
    expect(status.projects).toHaveLength(0)
  })

  it('shows initialized state after init', async () => {
    const { initCommand } = await import('../../src/commands/init.js')
    const { statusCommand } = await import('../../src/commands/status.js')

    await initCommand({ force: false })
    const status = await statusCommand({ json: true })

    expect(status.initialized).toBe(true)
    expect(status.ralphyHome).not.toBeNull()
  })

  it('lists linked projects', async () => {
    const { initCommand } = await import('../../src/commands/init.js')
    const { linkCommand } = await import('../../src/commands/link.js')
    const { statusCommand } = await import('../../src/commands/status.js')

    await initCommand({ force: false })

    const projectDir1 = join(getTestDir(), 'project-1')
    const projectDir2 = join(getTestDir(), 'project-2')
    mkdirSync(projectDir1, { recursive: true })
    mkdirSync(projectDir2, { recursive: true })

    await linkCommand(projectDir1, { name: 'Project One' })
    await linkCommand(projectDir2, { name: 'Project Two' })

    const status = await statusCommand({ json: true })

    expect(status.projects).toHaveLength(2)
    expect(status.projects.map(p => p.name).sort()).toEqual(['Project One', 'Project Two'])
  })

  it('shows server not running by default', async () => {
    const { initCommand } = await import('../../src/commands/init.js')
    const { statusCommand } = await import('../../src/commands/status.js')

    await initCommand({ force: false })
    const status = await statusCommand({ json: true })

    expect(status.server.running).toBe(false)
    expect(status.server.pid).toBeNull()
    expect(status.server.url).toBeNull()
  })
})
