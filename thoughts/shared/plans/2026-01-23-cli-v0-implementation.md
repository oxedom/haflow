# CLI v0 Implementation Plan

## Overview

Implement the Ralphy CLI package (`packages/cli`) with 6 commands: `init`, `link`, `unlink`, `start`, `stop`, `status`. This is the v0 "make it work" version - simplified with JSON config (no SQLite) and single-project-at-a-time linking.

## Current State Analysis

### What Exists
- Empty `packages/cli/` directory
- Monorepo structure with pnpm workspaces
- Backend at `packages/backend` (port 4000, `pnpm dev`)
- Frontend at `packages/frontend` (port 5173, `pnpm dev`)
- Existing PRD at `thoughts/prd-cli.md` (more comprehensive than v0 needs)

### Key Discoveries
- Backend dev command: `tsx watch src/index.ts` → `pnpm --filter @ralphy/backend dev`
- Frontend dev command: `vite` → `pnpm --filter frontend dev`
- Monorepo uses `workspace:*` for local deps
- All packages use ESM (`"type": "module"`)
- TypeScript config extends `../../tsconfig.base.json`

## Desired End State

After this plan is complete:
1. `npm install -g .` from `packages/cli` installs `ralphy` command globally
2. `ralphy init` creates `~/.ralphy/` with config file
3. `ralphy link` registers a project (one at a time, re-linking replaces)
4. `ralphy start` spawns both backend and frontend as child processes
5. `ralphy status` shows running state and linked project
6. `ralphy stop` gracefully terminates both services
7. `ralphy unlink` removes the linked project

### Verification
```bash
# Full flow test
ralphy init
cd /some/project && ralphy link
ralphy start  # Both services start, logs visible
ralphy status # Shows both running + linked project
ralphy stop   # Both services stop
ralphy unlink # Clears linked project
```

## What We're NOT Doing

- SQLite database (using JSON config for v0)
- Multiple linked projects (v0 = one project at a time)
- Daemon/background mode (v0 = foreground with Ctrl+C)
- Frontend build/preview mode (v0 = dev mode only)
- Streaming logs to file (logs go to terminal)
- `--verbose`, `--json` flags (defer to post-v0)

## Implementation Approach

1. Bootstrap CLI package with minimal dependencies
2. Create lib modules for paths and config
3. Implement commands incrementally, each with tests
4. Wire up Commander.js entry point
5. Add to workspace and verify global install works

---

## Phase 1: Package Bootstrap

### Overview
Create the CLI package structure with package.json, tsconfig, and initial files.

### Changes Required

#### 1. Add CLI to workspace
**File**: `pnpm-workspace.yaml`
**Changes**: Already lists `packages/*` so CLI is auto-included

#### 2. Create package.json
**File**: `packages/cli/package.json`

```json
{
  "name": "ralphy",
  "version": "0.0.1",
  "type": "module",
  "description": "CLI for Ralphy - multi-project Claude Code orchestrator",
  "author": "oxedom",
  "license": "MIT",
  "bin": {
    "ralphy": "./dist/index.js"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "engines": {
    "node": ">=18.0.0"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "prepublishOnly": "pnpm run build"
  },
  "dependencies": {
    "chalk": "^5.3.0",
    "commander": "^12.0.0",
    "ora": "^8.0.1"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.3",
    "vitest": "^1.2.0"
  }
}
```

#### 3. Create tsconfig.json
**File**: `packages/cli/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

#### 4. Create vitest.config.ts
**File**: `packages/cli/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts']
  }
})
```

#### 5. Create .gitignore
**File**: `packages/cli/.gitignore`

```
.env
node_modules/*
dist/*
```

#### 6. Create directory structure
```
packages/cli/
  src/
    index.ts         # Entry point (placeholder)
    lib/
      paths.ts       # Path constants
      config.ts      # Config read/write
    commands/
      init.ts
      link.ts
      unlink.ts
      start.ts
      stop.ts
      status.ts
  tests/
    setup.ts         # Test environment setup
```

#### 7. Create placeholder entry point
**File**: `packages/cli/src/index.ts`

```typescript
#!/usr/bin/env node
console.log('Ralphy CLI - coming soon')
```

### Success Criteria

#### Automated Verification
- [ ] Package installs: `cd packages/cli && pnpm install`
- [ ] TypeScript compiles: `pnpm build`
- [ ] CLI runs: `node dist/index.js` outputs "Ralphy CLI - coming soon"

#### Manual Verification
- [ ] Directory structure matches plan

---

## Phase 2: Path and Config Modules

### Overview
Create the foundational lib modules for path resolution and JSON config management.

### Changes Required

#### 1. Path constants
**File**: `packages/cli/src/lib/paths.ts`

```typescript
import { homedir } from 'os'
import { join } from 'path'

// Support override via env var for testing
export const RALPHY_HOME = process.env.RALPHY_HOME || join(homedir(), '.ralphy')
export const CONFIG_PATH = join(RALPHY_HOME, 'config.json')
export const BACKEND_PID_PATH = join(RALPHY_HOME, 'backend.pid')
export const FRONTEND_PID_PATH = join(RALPHY_HOME, 'frontend.pid')
```

#### 2. Config schema and operations
**File**: `packages/cli/src/lib/config.ts`

```typescript
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { RALPHY_HOME, CONFIG_PATH } from './paths.js'

export interface RalphyConfig {
  version: string
  linkedProject: {
    name: string
    path: string
  } | null
  server: {
    backendPort: number
    frontendPort: number
  }
}

const DEFAULT_CONFIG: RalphyConfig = {
  version: '0.0.1',
  linkedProject: null,
  server: {
    backendPort: 4000,
    frontendPort: 5173
  }
}

export function isInitialized(): boolean {
  return existsSync(CONFIG_PATH)
}

export function loadConfig(): RalphyConfig {
  if (!isInitialized()) {
    throw new Error('Ralphy not initialized. Run: ralphy init')
  }
  const content = readFileSync(CONFIG_PATH, 'utf-8')
  return JSON.parse(content) as RalphyConfig
}

export function saveConfig(config: RalphyConfig): void {
  if (!existsSync(RALPHY_HOME)) {
    mkdirSync(RALPHY_HOME, { recursive: true })
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
}

export function createDefaultConfig(): RalphyConfig {
  return { ...DEFAULT_CONFIG }
}
```

#### 3. Test setup
**File**: `packages/cli/tests/setup.ts`

```typescript
import { vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

let testDir: string

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'ralphy-test-'))
  vi.stubEnv('RALPHY_HOME', testDir)
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await rm(testDir, { recursive: true, force: true })
})

export function getTestDir(): string {
  return testDir
}
```

#### 4. Config tests
**File**: `packages/cli/tests/lib/config.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { isInitialized, loadConfig, saveConfig, createDefaultConfig } from '../../src/lib/config.js'
import { RALPHY_HOME, CONFIG_PATH } from '../../src/lib/paths.js'

describe('config', () => {
  it('isInitialized returns false when not initialized', () => {
    expect(isInitialized()).toBe(false)
  })

  it('saveConfig creates directory and file', () => {
    const config = createDefaultConfig()
    saveConfig(config)

    expect(existsSync(RALPHY_HOME)).toBe(true)
    expect(existsSync(CONFIG_PATH)).toBe(true)
  })

  it('loadConfig returns saved config', () => {
    const config = createDefaultConfig()
    config.linkedProject = { name: 'test', path: '/test/path' }
    saveConfig(config)

    const loaded = loadConfig()
    expect(loaded.linkedProject?.name).toBe('test')
  })

  it('loadConfig throws when not initialized', () => {
    expect(() => loadConfig()).toThrow('Ralphy not initialized')
  })
})
```

### Success Criteria

#### Automated Verification
- [ ] Build succeeds: `pnpm build`
- [ ] Tests pass: `pnpm test`

#### Manual Verification
- [ ] N/A (covered by tests)

---

## Phase 3: Init Command

### Overview
Implement the `init` command that creates ~/.ralphy and config.json.

### Changes Required

#### 1. Init command
**File**: `packages/cli/src/commands/init.ts`

```typescript
import chalk from 'chalk'
import ora from 'ora'
import { existsSync, mkdirSync } from 'fs'
import { RALPHY_HOME, CONFIG_PATH } from '../lib/paths.js'
import { isInitialized, saveConfig, createDefaultConfig } from '../lib/config.js'

interface InitOptions {
  force?: boolean
}

export async function initCommand(options: InitOptions = {}): Promise<void> {
  const spinner = ora('Initializing Ralphy...').start()

  try {
    if (isInitialized() && !options.force) {
      spinner.info('Ralphy already initialized')
      console.log(chalk.dim(`  Config: ${CONFIG_PATH}`))
      return
    }

    // Create directory
    if (!existsSync(RALPHY_HOME)) {
      mkdirSync(RALPHY_HOME, { recursive: true })
    }

    // Create config
    const config = createDefaultConfig()
    saveConfig(config)

    spinner.succeed('Ralphy initialized')
    console.log()
    console.log(chalk.dim(`  Created: ${CONFIG_PATH}`))
    console.log()
    console.log('Next steps:')
    console.log(chalk.cyan('  cd <your-project>'))
    console.log(chalk.cyan('  ralphy link'))
  } catch (error) {
    spinner.fail('Failed to initialize')
    console.error(chalk.red(error instanceof Error ? error.message : String(error)))
    process.exit(1)
  }
}
```

#### 2. Init tests
**File**: `packages/cli/tests/commands/init.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest'
import { existsSync } from 'fs'
import { initCommand } from '../../src/commands/init.js'
import { RALPHY_HOME, CONFIG_PATH } from '../../src/lib/paths.js'
import { loadConfig } from '../../src/lib/config.js'

// Mock ora to avoid spinner output in tests
vi.mock('ora', () => ({
  default: () => ({
    start: () => ({
      succeed: vi.fn(),
      fail: vi.fn(),
      info: vi.fn()
    })
  })
}))

describe('init command', () => {
  it('creates ~/.ralphy directory', async () => {
    await initCommand()
    expect(existsSync(RALPHY_HOME)).toBe(true)
  })

  it('creates config.json with defaults', async () => {
    await initCommand()
    const config = loadConfig()
    expect(config.version).toBe('0.0.1')
    expect(config.linkedProject).toBeNull()
  })

  it('is idempotent without --force', async () => {
    await initCommand()
    await initCommand() // Should not throw
    expect(existsSync(CONFIG_PATH)).toBe(true)
  })

  it('reinitializes with --force', async () => {
    await initCommand()
    await initCommand({ force: true })
    expect(existsSync(CONFIG_PATH)).toBe(true)
  })
})
```

### Success Criteria

#### Automated Verification
- [ ] Build succeeds: `pnpm build`
- [ ] Tests pass: `pnpm test`
- [ ] Command runs: `node dist/index.js init` (after wiring in Phase 7)

#### Manual Verification
- [ ] `~/.ralphy/config.json` created with correct structure

---

## Phase 4: Link and Unlink Commands

### Overview
Implement `link` to register a project and `unlink` to remove it. v0 supports only one linked project at a time.

### Changes Required

#### 1. Link command
**File**: `packages/cli/src/commands/link.ts`

```typescript
import chalk from 'chalk'
import ora from 'ora'
import { existsSync, statSync } from 'fs'
import { resolve, basename } from 'path'
import { isInitialized, loadConfig, saveConfig } from '../lib/config.js'

interface LinkOptions {
  name?: string
}

export async function linkCommand(pathArg?: string, options: LinkOptions = {}): Promise<void> {
  const spinner = ora('Linking project...').start()

  try {
    // Check initialized
    if (!isInitialized()) {
      spinner.fail('Ralphy not initialized')
      console.log(chalk.yellow('Run: ralphy init'))
      process.exit(1)
    }

    // Resolve path
    const projectPath = resolve(pathArg || process.cwd())

    // Validate directory exists
    if (!existsSync(projectPath) || !statSync(projectPath).isDirectory()) {
      spinner.fail('Invalid path')
      console.log(chalk.red(`Not a directory: ${projectPath}`))
      process.exit(1)
    }

    // Determine project name
    const projectName = options.name || basename(projectPath)

    // Check for git repo (warning only)
    const gitPath = resolve(projectPath, '.git')
    if (!existsSync(gitPath)) {
      spinner.warn('Not a git repository (continuing anyway)')
      spinner.start('Linking project...')
    }

    // Update config (replace any existing linked project)
    const config = loadConfig()
    const wasLinked = config.linkedProject !== null

    config.linkedProject = {
      name: projectName,
      path: projectPath
    }
    saveConfig(config)

    spinner.succeed(`Linked project "${projectName}"`)
    console.log(chalk.dim(`  Path: ${projectPath}`))

    if (wasLinked) {
      console.log(chalk.yellow('  (Replaced previously linked project)'))
    }

    console.log()
    console.log('Next steps:')
    console.log(chalk.cyan('  ralphy start'))
  } catch (error) {
    spinner.fail('Failed to link project')
    console.error(chalk.red(error instanceof Error ? error.message : String(error)))
    process.exit(1)
  }
}
```

#### 2. Unlink command
**File**: `packages/cli/src/commands/unlink.ts`

```typescript
import chalk from 'chalk'
import ora from 'ora'
import { isInitialized, loadConfig, saveConfig } from '../lib/config.js'

export async function unlinkCommand(): Promise<void> {
  const spinner = ora('Unlinking project...').start()

  try {
    if (!isInitialized()) {
      spinner.fail('Ralphy not initialized')
      console.log(chalk.yellow('Run: ralphy init'))
      process.exit(1)
    }

    const config = loadConfig()

    if (!config.linkedProject) {
      spinner.info('No project currently linked')
      return
    }

    const projectName = config.linkedProject.name
    config.linkedProject = null
    saveConfig(config)

    spinner.succeed(`Unlinked project "${projectName}"`)
  } catch (error) {
    spinner.fail('Failed to unlink project')
    console.error(chalk.red(error instanceof Error ? error.message : String(error)))
    process.exit(1)
  }
}
```

#### 3. Link tests
**File**: `packages/cli/tests/commands/link.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { linkCommand } from '../../src/commands/link.js'
import { unlinkCommand } from '../../src/commands/unlink.js'
import { initCommand } from '../../src/commands/init.js'
import { loadConfig } from '../../src/lib/config.js'
import { getTestDir } from '../setup.js'

vi.mock('ora', () => ({
  default: () => ({
    start: () => ({
      succeed: vi.fn(),
      fail: vi.fn(),
      info: vi.fn(),
      warn: vi.fn()
    })
  })
}))

describe('link command', () => {
  let projectDir: string

  beforeEach(async () => {
    await initCommand()
    // Create a test project directory
    projectDir = join(getTestDir(), 'test-project')
    mkdirSync(projectDir, { recursive: true })
    // Make it a git repo
    mkdirSync(join(projectDir, '.git'))
  })

  it('links a project', async () => {
    await linkCommand(projectDir)
    const config = loadConfig()
    expect(config.linkedProject?.path).toBe(projectDir)
  })

  it('uses directory name as default project name', async () => {
    await linkCommand(projectDir)
    const config = loadConfig()
    expect(config.linkedProject?.name).toBe('test-project')
  })

  it('uses custom name when provided', async () => {
    await linkCommand(projectDir, { name: 'my-custom-name' })
    const config = loadConfig()
    expect(config.linkedProject?.name).toBe('my-custom-name')
  })

  it('replaces existing linked project', async () => {
    const secondProject = join(getTestDir(), 'second-project')
    mkdirSync(secondProject)

    await linkCommand(projectDir)
    await linkCommand(secondProject)

    const config = loadConfig()
    expect(config.linkedProject?.path).toBe(secondProject)
  })
})

describe('unlink command', () => {
  beforeEach(async () => {
    await initCommand()
    const projectDir = join(getTestDir(), 'test-project')
    mkdirSync(projectDir)
    await linkCommand(projectDir)
  })

  it('unlinks the project', async () => {
    await unlinkCommand()
    const config = loadConfig()
    expect(config.linkedProject).toBeNull()
  })

  it('is idempotent', async () => {
    await unlinkCommand()
    await unlinkCommand() // Should not throw
  })
})
```

### Success Criteria

#### Automated Verification
- [ ] Build succeeds: `pnpm build`
- [ ] Tests pass: `pnpm test`

#### Manual Verification
- [ ] Link a project and verify config.json shows it
- [ ] Re-link replaces the project
- [ ] Unlink clears the project

---

## Phase 5: Start and Stop Commands

### Overview
Implement `start` to spawn both backend and frontend as child processes, and `stop` to terminate them. Uses PID files for tracking.

### Changes Required

#### 1. Start command
**File**: `packages/cli/src/commands/start.ts`

```typescript
import chalk from 'chalk'
import ora from 'ora'
import { spawn, ChildProcess } from 'child_process'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { resolve } from 'path'
import { isInitialized, loadConfig } from '../lib/config.js'
import { BACKEND_PID_PATH, FRONTEND_PID_PATH, RALPHY_HOME } from '../lib/paths.js'

// Find monorepo root (where pnpm-workspace.yaml lives)
function findMonorepoRoot(): string {
  // Walk up from this file's location to find workspace root
  let dir = resolve(import.meta.dirname, '..', '..', '..', '..')

  // Verify it's the monorepo root
  if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) {
    return dir
  }

  // Fallback: check if RALPHY_MONOREPO_ROOT is set
  if (process.env.RALPHY_MONOREPO_ROOT) {
    return process.env.RALPHY_MONOREPO_ROOT
  }

  throw new Error('Cannot find Ralphy monorepo root')
}

function isRunning(pidPath: string): boolean {
  if (!existsSync(pidPath)) return false

  const pid = parseInt(readFileSync(pidPath, 'utf-8').trim(), 10)
  try {
    process.kill(pid, 0) // Signal 0 just checks if process exists
    return true
  } catch {
    // Process doesn't exist, clean up stale PID file
    unlinkSync(pidPath)
    return false
  }
}

function savePid(pidPath: string, pid: number): void {
  writeFileSync(pidPath, pid.toString())
}

export async function startCommand(): Promise<void> {
  const spinner = ora('Starting Ralphy...').start()

  try {
    if (!isInitialized()) {
      spinner.fail('Ralphy not initialized')
      console.log(chalk.yellow('Run: ralphy init'))
      process.exit(1)
    }

    const config = loadConfig()

    // Check if already running
    if (isRunning(BACKEND_PID_PATH) || isRunning(FRONTEND_PID_PATH)) {
      spinner.info('Ralphy services already running')
      console.log(chalk.yellow('Run: ralphy stop  to stop them first'))
      return
    }

    const monorepoRoot = findMonorepoRoot()
    spinner.text = 'Starting backend...'

    // Start backend
    const backend = spawn('pnpm', ['--filter', '@ralphy/backend', 'dev'], {
      cwd: monorepoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    })

    if (backend.pid) {
      savePid(BACKEND_PID_PATH, backend.pid)
    }

    // Prefix backend output
    backend.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(l => l.trim())
      lines.forEach(line => console.log(chalk.blue('[backend]'), line))
    })
    backend.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(l => l.trim())
      lines.forEach(line => console.log(chalk.blue('[backend]'), chalk.red(line)))
    })

    spinner.text = 'Starting frontend...'

    // Start frontend
    const frontend = spawn('pnpm', ['--filter', 'frontend', 'dev'], {
      cwd: monorepoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    })

    if (frontend.pid) {
      savePid(FRONTEND_PID_PATH, frontend.pid)
    }

    // Prefix frontend output
    frontend.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(l => l.trim())
      lines.forEach(line => console.log(chalk.magenta('[frontend]'), line))
    })
    frontend.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(l => l.trim())
      lines.forEach(line => console.log(chalk.magenta('[frontend]'), chalk.red(line)))
    })

    spinner.succeed('Ralphy started')
    console.log()
    console.log(`  Backend:  ${chalk.cyan(`http://localhost:${config.server.backendPort}`)}`)
    console.log(`  Frontend: ${chalk.cyan(`http://localhost:${config.server.frontendPort}`)}`)

    if (config.linkedProject) {
      console.log(`  Project:  ${chalk.green(config.linkedProject.name)}`)
    } else {
      console.log(chalk.yellow('  No project linked. Run: ralphy link'))
    }

    console.log()
    console.log(chalk.dim('Press Ctrl+C to stop'))
    console.log()

    // Handle graceful shutdown
    const cleanup = () => {
      console.log()
      console.log(chalk.dim('Shutting down...'))

      backend.kill('SIGTERM')
      frontend.kill('SIGTERM')

      if (existsSync(BACKEND_PID_PATH)) unlinkSync(BACKEND_PID_PATH)
      if (existsSync(FRONTEND_PID_PATH)) unlinkSync(FRONTEND_PID_PATH)

      process.exit(0)
    }

    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)

    // Handle process exit
    backend.on('close', (code) => {
      if (existsSync(BACKEND_PID_PATH)) unlinkSync(BACKEND_PID_PATH)
      if (code !== 0 && code !== null) {
        console.log(chalk.red(`Backend exited with code ${code}`))
      }
    })

    frontend.on('close', (code) => {
      if (existsSync(FRONTEND_PID_PATH)) unlinkSync(FRONTEND_PID_PATH)
      if (code !== 0 && code !== null) {
        console.log(chalk.red(`Frontend exited with code ${code}`))
      }
    })

  } catch (error) {
    spinner.fail('Failed to start')
    console.error(chalk.red(error instanceof Error ? error.message : String(error)))
    process.exit(1)
  }
}
```

#### 2. Stop command
**File**: `packages/cli/src/commands/stop.ts`

```typescript
import chalk from 'chalk'
import ora from 'ora'
import { existsSync, readFileSync, unlinkSync } from 'fs'
import { isInitialized } from '../lib/config.js'
import { BACKEND_PID_PATH, FRONTEND_PID_PATH } from '../lib/paths.js'

function stopProcess(pidPath: string, name: string): boolean {
  if (!existsSync(pidPath)) {
    return false
  }

  const pid = parseInt(readFileSync(pidPath, 'utf-8').trim(), 10)

  try {
    process.kill(pid, 'SIGTERM')
    unlinkSync(pidPath)
    return true
  } catch (error) {
    // Process might already be dead
    if (existsSync(pidPath)) {
      unlinkSync(pidPath)
    }
    return false
  }
}

export async function stopCommand(): Promise<void> {
  const spinner = ora('Stopping Ralphy...').start()

  try {
    if (!isInitialized()) {
      spinner.fail('Ralphy not initialized')
      console.log(chalk.yellow('Run: ralphy init'))
      process.exit(1)
    }

    const backendStopped = stopProcess(BACKEND_PID_PATH, 'backend')
    const frontendStopped = stopProcess(FRONTEND_PID_PATH, 'frontend')

    if (!backendStopped && !frontendStopped) {
      spinner.info('No Ralphy services running')
      return
    }

    spinner.succeed('Ralphy stopped')

    if (backendStopped) {
      console.log(chalk.dim('  Stopped backend'))
    }
    if (frontendStopped) {
      console.log(chalk.dim('  Stopped frontend'))
    }
  } catch (error) {
    spinner.fail('Failed to stop')
    console.error(chalk.red(error instanceof Error ? error.message : String(error)))
    process.exit(1)
  }
}
```

#### 3. Start/stop tests
**File**: `packages/cli/tests/commands/start.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { initCommand } from '../../src/commands/init.js'

// These are mostly integration tests - basic unit coverage here
vi.mock('ora', () => ({
  default: () => ({
    start: () => ({
      succeed: vi.fn(),
      fail: vi.fn(),
      info: vi.fn(),
      text: ''
    })
  })
}))

describe('start command', () => {
  beforeEach(async () => {
    await initCommand()
  })

  it('requires initialization', async () => {
    // Start/stop commands are mostly integration tests
    // Here we just verify the modules load correctly
    const { startCommand } = await import('../../src/commands/start.js')
    expect(typeof startCommand).toBe('function')
  })
})

describe('stop command', () => {
  it('exports stop function', async () => {
    const { stopCommand } = await import('../../src/commands/stop.js')
    expect(typeof stopCommand).toBe('function')
  })
})
```

### Success Criteria

#### Automated Verification
- [ ] Build succeeds: `pnpm build`
- [ ] Tests pass: `pnpm test`

#### Manual Verification
- [ ] `ralphy start` spawns both services with colored prefixed output
- [ ] Both services accessible (backend:4000, frontend:5173)
- [ ] Ctrl+C stops both services cleanly
- [ ] PID files created/removed appropriately
- [ ] `ralphy stop` terminates running services

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that start/stop work correctly before proceeding to the next phase.

---

## Phase 6: Status Command

### Overview
Implement `status` to show initialization state, running services, and linked project.

### Changes Required

#### 1. Status command
**File**: `packages/cli/src/commands/status.ts`

```typescript
import chalk from 'chalk'
import { existsSync, readFileSync } from 'fs'
import { isInitialized, loadConfig } from '../lib/config.js'
import { RALPHY_HOME, CONFIG_PATH, BACKEND_PID_PATH, FRONTEND_PID_PATH } from '../lib/paths.js'

function isProcessRunning(pidPath: string): boolean {
  if (!existsSync(pidPath)) return false

  const pid = parseInt(readFileSync(pidPath, 'utf-8').trim(), 10)
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export async function statusCommand(): Promise<void> {
  console.log()
  console.log(chalk.bold('Ralphy Status'))
  console.log(chalk.dim('─'.repeat(40)))
  console.log()

  // Initialization
  const initialized = isInitialized()
  console.log(
    `Initialized:  ${initialized ? chalk.green('✓') : chalk.red('✗')} ${chalk.dim(RALPHY_HOME)}`
  )

  if (!initialized) {
    console.log()
    console.log(chalk.yellow('Run: ralphy init'))
    return
  }

  const config = loadConfig()

  // Services
  const backendRunning = isProcessRunning(BACKEND_PID_PATH)
  const frontendRunning = isProcessRunning(FRONTEND_PID_PATH)

  console.log()
  console.log(chalk.bold('Services'))
  console.log(
    `  Backend:    ${backendRunning ? chalk.green('● Running') : chalk.dim('○ Stopped')}` +
    chalk.dim(` (port ${config.server.backendPort})`)
  )
  console.log(
    `  Frontend:   ${frontendRunning ? chalk.green('● Running') : chalk.dim('○ Stopped')}` +
    chalk.dim(` (port ${config.server.frontendPort})`)
  )

  // Linked project
  console.log()
  console.log(chalk.bold('Linked Project'))

  if (config.linkedProject) {
    console.log(`  Name:       ${chalk.cyan(config.linkedProject.name)}`)
    console.log(`  Path:       ${chalk.dim(config.linkedProject.path)}`)
  } else {
    console.log(chalk.dim('  No project linked'))
    console.log(chalk.yellow('  Run: cd <project> && ralphy link'))
  }

  console.log()
}
```

#### 2. Status tests
**File**: `packages/cli/tests/commands/status.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { initCommand } from '../../src/commands/init.js'
import { linkCommand } from '../../src/commands/link.js'
import { statusCommand } from '../../src/commands/status.js'
import { getTestDir } from '../setup.js'

// Capture console output
let consoleOutput: string[] = []
const originalLog = console.log

beforeEach(() => {
  consoleOutput = []
  console.log = (...args: unknown[]) => {
    consoleOutput.push(args.map(String).join(' '))
  }
})

afterEach(() => {
  console.log = originalLog
})

describe('status command', () => {
  it('shows not initialized message', async () => {
    await statusCommand()
    expect(consoleOutput.some(l => l.includes('ralphy init'))).toBe(true)
  })

  it('shows initialized status', async () => {
    await initCommand()
    await statusCommand()
    expect(consoleOutput.some(l => l.includes('Initialized'))).toBe(true)
  })

  it('shows linked project', async () => {
    await initCommand()
    const projectDir = join(getTestDir(), 'my-project')
    mkdirSync(projectDir)
    await linkCommand(projectDir)

    await statusCommand()
    expect(consoleOutput.some(l => l.includes('my-project'))).toBe(true)
  })
})
```

### Success Criteria

#### Automated Verification
- [ ] Build succeeds: `pnpm build`
- [ ] Tests pass: `pnpm test`

#### Manual Verification
- [ ] Status shows initialization state correctly
- [ ] Status shows running/stopped services
- [ ] Status shows linked project info

---

## Phase 7: Wire Up Commander Entry Point

### Overview
Connect all commands to Commander.js and make the CLI executable.

### Changes Required

#### 1. Complete entry point
**File**: `packages/cli/src/index.ts`

```typescript
#!/usr/bin/env node
import { program } from 'commander'
import { initCommand } from './commands/init.js'
import { linkCommand } from './commands/link.js'
import { unlinkCommand } from './commands/unlink.js'
import { startCommand } from './commands/start.js'
import { stopCommand } from './commands/stop.js'
import { statusCommand } from './commands/status.js'

program
  .name('ralphy')
  .description('CLI for Ralphy - multi-project Claude Code orchestrator')
  .version('0.0.1')

program
  .command('init')
  .description('Initialize Ralphy on this machine')
  .option('--force', 'Reinitialize even if exists')
  .action(initCommand)

program
  .command('link [path]')
  .description('Link a project to Ralphy (replaces any existing link)')
  .option('--name <name>', 'Custom project name')
  .action(linkCommand)

program
  .command('unlink')
  .description('Unlink the current project')
  .action(unlinkCommand)

program
  .command('start')
  .description('Start backend and frontend servers')
  .action(startCommand)

program
  .command('stop')
  .description('Stop backend and frontend servers')
  .action(stopCommand)

program
  .command('status')
  .description('Show Ralphy status and linked project')
  .action(statusCommand)

program.parse()
```

### Success Criteria

#### Automated Verification
- [ ] Build succeeds: `pnpm build`
- [ ] All tests pass: `pnpm test`
- [ ] CLI runs: `node dist/index.js --help`
- [ ] All commands listed in help output

#### Manual Verification
- [ ] `ralphy --help` shows all commands
- [ ] `ralphy init --help` shows init options
- [ ] `ralphy link --help` shows link options

---

## Phase 8: Final Integration & Global Install

### Overview
Ensure the package can be installed globally and works end-to-end.

### Changes Required

#### 1. Build the package
```bash
cd packages/cli
pnpm install
pnpm build
```

#### 2. Test local global install
```bash
cd packages/cli
npm link  # Creates global symlink
ralphy --help
```

#### 3. Full end-to-end test
```bash
# Initialize
ralphy init
ralphy status  # Should show initialized, nothing running

# Link a project
cd /tmp && mkdir test-project && cd test-project && git init
ralphy link
ralphy status  # Should show linked project

# Start services
ralphy start  # Both should start, logs visible
# Open browser to http://localhost:5173

# In another terminal
ralphy status  # Should show both running

# Stop
Ctrl+C  # or ralphy stop from another terminal
ralphy status  # Should show both stopped

# Cleanup
ralphy unlink
ralphy status  # Should show no linked project
```

### Success Criteria

#### Automated Verification
- [ ] `pnpm build` succeeds
- [ ] `pnpm test` passes all tests
- [ ] `npm link` completes without errors

#### Manual Verification
- [ ] Full end-to-end flow works as described above
- [ ] UI loads at localhost:5173 after `ralphy start`
- [ ] Backend API responds at localhost:4000/api
- [ ] Ctrl+C gracefully stops both services
- [ ] PID files are created and cleaned up appropriately

---

## Testing Strategy

### Unit Tests
- Path resolution with different RALPHY_HOME values
- Config loading, saving, validation
- Individual command logic with mocked I/O

### Integration Tests
- Full init → link → status flow
- Start/stop with actual process spawning (optional, may require CI setup)

### Manual Testing Steps
1. Fresh install: `npm link` from packages/cli
2. `ralphy init` on clean system
3. `ralphy link` from a project directory
4. `ralphy start` - verify both services start
5. Access frontend in browser
6. `ralphy stop` - verify clean shutdown
7. `ralphy unlink` - verify project removed
8. `ralphy status` at each step

## Performance Considerations

- Process spawning is fast (< 1s)
- Config JSON read/write is synchronous but files are small
- No performance concerns for v0

## Migration Notes

N/A - this is a new package

## References

- v0 spec: `/home/s-linux/projects/ralphy/ralphy-v0-working-spec.md`
- Existing PRD: `/home/s-linux/projects/ralphy/thoughts/prd-cli.md`
- Backend package: `/home/s-linux/projects/ralphy/packages/backend/package.json`
- Frontend package: `/home/s-linux/projects/ralphy/packages/frontend/package.json`
