import { vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

let testDir: string

// Mock chalk with proper chaining support
vi.mock('chalk', () => {
  const createChainableProxy = (): unknown => {
    const handler: ProxyHandler<(str: string) => string> = {
      get: () => createChainableProxy(),
      apply: (_target, _thisArg, args: [string]) => args[0]
    }
    return new Proxy((str: string) => str, handler)
  }

  return {
    default: createChainableProxy()
  }
})

// Mock ora
vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis()
  })
}))

beforeEach(async () => {
  // Create a unique temp directory for each test
  testDir = await mkdtemp(join(tmpdir(), 'ralphy-test-'))

  // Stub RALPHY_HOME before any modules are imported
  vi.stubEnv('RALPHY_HOME', testDir)

  // Reset all module caches to pick up new env
  vi.resetModules()
})

afterEach(async () => {
  vi.unstubAllEnvs()

  // Clean up temp directory
  try {
    await rm(testDir, { recursive: true, force: true })
  } catch {
    // Ignore cleanup errors
  }
})

export function getTestDir(): string {
  return testDir
}
