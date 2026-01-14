import { describe, it, expect } from 'vitest'
import { mkdirSync } from 'fs'
import { getTestDir } from '../setup.js'

describe('config', () => {
  it('getDefaultConfig returns valid config', async () => {
    const { getDefaultConfig } = await import('../../src/lib/config.js')
    const config = getDefaultConfig()

    expect(config.version).toBe('0.0.1')
    expect(config.server.port).toBe(3847)
    expect(config.server.host).toBe('127.0.0.1')
    expect(config.database.path).toBe('~/.ralphy/ralphy.sqlite')
    expect(config.logging.level).toBe('info')
  })

  it('configExists returns false when not initialized', async () => {
    const { configExists } = await import('../../src/lib/config.js')
    expect(configExists()).toBe(false)
  })

  it('saveGlobalConfig and loadGlobalConfig work correctly', async () => {
    const { getDefaultConfig, saveGlobalConfig, loadGlobalConfig, configExists } = await import('../../src/lib/config.js')
    const { RALPHY_HOME } = await import('../../src/lib/paths.js')

    // Create the directory first
    mkdirSync(RALPHY_HOME, { recursive: true })

    const config = getDefaultConfig()
    config.server.port = 4000

    saveGlobalConfig(config)

    expect(configExists()).toBe(true)
    const loaded = loadGlobalConfig()
    expect(loaded).not.toBeNull()
    expect(loaded?.server.port).toBe(4000)
  })

  it('loadGlobalConfig returns null when config does not exist', async () => {
    const { loadGlobalConfig } = await import('../../src/lib/config.js')
    const loaded = loadGlobalConfig()
    expect(loaded).toBeNull()
  })
})
