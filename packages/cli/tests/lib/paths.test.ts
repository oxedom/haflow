import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { homedir } from 'os'

describe('paths', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses RALPHY_HOME env variable when set', async () => {
    vi.stubEnv('RALPHY_HOME', '/custom/path')
    vi.resetModules()
    const { RALPHY_HOME } = await import('../../src/lib/paths.js')
    expect(RALPHY_HOME).toBe('/custom/path')
  })

  it('defaults to ~/.ralphy when RALPHY_HOME not set', async () => {
    vi.stubEnv('RALPHY_HOME', '')
    vi.resetModules()
    const { RALPHY_HOME } = await import('../../src/lib/paths.js')
    expect(RALPHY_HOME).toBe(join(homedir(), '.ralphy'))
  })

  it('getProjectRalphyDir returns correct path', async () => {
    const { getProjectRalphyDir } = await import('../../src/lib/paths.js')
    expect(getProjectRalphyDir('/projects/my-app')).toBe('/projects/my-app/.ralphy')
  })

  it('getMissionDir returns correct path', async () => {
    const { getMissionDir } = await import('../../src/lib/paths.js')
    expect(getMissionDir('/projects/my-app', 'feature-x')).toBe('/projects/my-app/.ralphy/missions/feature-x')
  })
})
