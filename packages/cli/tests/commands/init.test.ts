import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { getTestDir } from '../setup.js'

describe('init command', () => {
  it('creates .ralphy directory', async () => {
    const { initCommand } = await import('../../src/commands/init.js')
    const { RALPHY_HOME, GLOBAL_CONFIG_PATH, GLOBAL_DB_PATH } = await import('../../src/lib/paths.js')

    const result = await initCommand({ force: false })

    expect(result.success).toBe(true)
    expect(existsSync(RALPHY_HOME)).toBe(true)
    expect(existsSync(GLOBAL_CONFIG_PATH)).toBe(true)
    expect(existsSync(GLOBAL_DB_PATH)).toBe(true)
  })

  it('returns alreadyInitialized when already initialized', async () => {
    const { initCommand } = await import('../../src/commands/init.js')

    await initCommand({ force: false })
    const result = await initCommand({ force: false })

    expect(result.success).toBe(true)
    expect(result.alreadyInitialized).toBe(true)
  })

  it('reinitializes with --force', async () => {
    const { initCommand } = await import('../../src/commands/init.js')
    const { RALPHY_HOME } = await import('../../src/lib/paths.js')

    await initCommand({ force: false })
    const result = await initCommand({ force: true })

    expect(result.success).toBe(true)
    expect(result.reinitialized).toBe(true)
    expect(existsSync(RALPHY_HOME)).toBe(true)
  })
})
