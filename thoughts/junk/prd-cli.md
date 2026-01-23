# PRD: Haloop CLI

## Overview
Global command-line interface for Haloop - initializes the system, links projects, and starts the backend server.

**Package:** `haloop` (global install via `npm install -g`)
**Stack:** Commander.js, better-sqlite3, chalk, ora, TypeScript, Vitest

---

## Goals
1. Provide simple CLI commands to initialize and manage Haloop
2. Create and manage global configuration at `~/.haloop/`
3. Link projects to the central Haloop instance
4. Start/stop the backend server

---

## Package Structure

```
packages/cli/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts          # Commander.js entry point
    lib/
      paths.ts        # HALOOP_HOME, GLOBAL_DB_PATH, etc.
      config.ts       # loadGlobalConfig, saveGlobalConfig
      database.ts     # Database access utilities
    commands/
      init.ts         # Create ~/.haloop, init SQLite
      link.ts         # Register project, create .haloop/
      unlink.ts       # Unregister project
      start.ts        # Start backend server
      stop.ts         # Stop backend server
      status.ts       # Show linked projects and server status
  tests/
    setup.ts          # Test environment setup
    lib/
      paths.test.ts   # Path resolution tests
      config.test.ts  # Config loading tests
    commands/
      init.test.ts
      link.test.ts
      status.test.ts
```

---

## Dependencies

```json
{
  "name": "haloop",
  "version": "0.0.1",
  "type": "module",
  "bin": {
    "haloop": "./dist/index.js"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@haloop/shared": "workspace:*",
    "better-sqlite3": "^11.0.0",
    "chalk": "^5.3.0",
    "commander": "^12.0.0",
    "ora": "^8.0.1"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.8",
    "typescript": "^5.3.3"
  }
}
```

---

## Global Configuration

### Directory Structure
```
~/.haloop/
  config.json       # Global settings
  haloop.sqlite     # Central database
  logs/             # Server logs (optional)
```

### config.json
```json
{
  "version": "0.0.1",
  "server": {
    "port": 3847,
    "host": "127.0.0.1"
  },
  "database": {
    "path": "~/.haloop/haloop.sqlite"
  },
  "logging": {
    "level": "info",
    "file": "~/.haloop/logs/server.log"
  }
}
```

---

## Path Resolution (`lib/paths.ts`)

```typescript
export const HALOOP_HOME = process.env.HALOOP_HOME || join(homedir(), '.haloop')
export const GLOBAL_CONFIG_PATH = join(HALOOP_HOME, 'config.json')
export const GLOBAL_DB_PATH = join(HALOOP_HOME, 'haloop.sqlite')
export const PROJECT_DIR_NAME = '.haloop'

export function getProjectHaloopDir(projectPath: string): string {
  return join(projectPath, PROJECT_DIR_NAME)
}

export function getMissionDir(projectPath: string, missionName: string): string {
  return join(getProjectHaloopDir(projectPath), 'missions', missionName)
}
```

---

## Commands

### `haloop init`

Initialize Haloop on this machine.

**Actions:**
1. Create `~/.haloop/` directory if not exists
2. Create default `config.json`
3. Initialize SQLite database with schema
4. Display success message with next steps

**Flags:**
- `--force` - Reinitialize even if already exists

**Output:**
```
✓ Created ~/.haloop/
✓ Initialized config.json
✓ Created database

Haloop initialized! Next steps:
  cd <your-project>
  haloop link
```

**Error Cases:**
- Already initialized (without --force): Show message, exit 0
- Permission denied: Show error, exit 1

---

### `haloop link [path]`

Link a project to Haloop.

**Arguments:**
- `path` - Project path (default: current directory)

**Actions:**
1. Verify Haloop is initialized
2. Verify path is a valid directory
3. Verify path contains a git repository (warning if not)
4. Create `<project>/.haloop/` directory
5. Create project config file
6. Register project in global database
7. Display success message

**Flags:**
- `--name <name>` - Custom project name (default: directory name)

**Output:**
```
✓ Created .haloop/ directory
✓ Registered project "my-app"

Project linked! ID: abc-123
```

**Error Cases:**
- Haloop not initialized: Prompt to run `haloop init`
- Project already linked: Show existing info, exit 0
- Invalid path: Show error, exit 1

---

### `haloop unlink [path]`

Unlink a project from Haloop.

**Arguments:**
- `path` - Project path (default: current directory)

**Actions:**
1. Verify project is linked
2. Mark project as inactive in database (soft delete)
3. Optionally remove `.haloop/` directory

**Flags:**
- `--remove-dir` - Also remove the `.haloop/` directory
- `--hard` - Permanently delete from database

**Output:**
```
✓ Unlinked project "my-app"
```

---

### `haloop start`

Start the Haloop backend server.

**Actions:**
1. Verify Haloop is initialized
2. Check if server already running (PID file)
3. Import and start `@haloop/backend` server
4. Save PID to `~/.haloop/server.pid`
5. Display server URL

**Flags:**
- `--port <port>` - Override port from config
- `--daemon` - Run in background
- `--verbose` - Show detailed logs

**Output:**
```
✓ Server starting...
✓ Haloop running at http://127.0.0.1:3847

Press Ctrl+C to stop
```

**Daemon Output:**
```
✓ Server started in background (PID: 12345)

Stop with: haloop stop
```

---

### `haloop stop`

Stop the Haloop backend server.

**Actions:**
1. Read PID from `~/.haloop/server.pid`
2. Send SIGTERM to process
3. Remove PID file
4. Display confirmation

**Output:**
```
✓ Server stopped
```

**Error Cases:**
- Server not running: Show message, exit 0
- Cannot stop (permission): Show error, exit 1

---

### `haloop status`

Show Haloop status and linked projects.

**Actions:**
1. Check if initialized
2. Check if server running
3. List all linked projects from database

**Output:**
```
Haloop Status
─────────────
Initialized: ✓ ~/.haloop/
Server:      ✓ Running at http://127.0.0.1:3847

Linked Projects (3)
───────────────────
  my-app         /home/user/projects/my-app         (2 missions)
  api-service    /home/user/projects/api-service    (0 missions)
  website        /home/user/projects/website        (5 missions)
```

**Flags:**
- `--json` - Output as JSON

---

## Per-Project Configuration

### Directory Structure
```
<project>/.haloop/
  config.ts         # Project-specific settings (optional)
  missions/
    <mission-name>/
      PRD.md        # Generated PRD
      tasks.json    # Task breakdown
      progress.txt  # Execution log
```

### config.ts (Optional)
```typescript
import { ProjectConfig } from '@haloop/shared'

export default {
  // Override default agents/skills for this project
  defaultAgents: ['coder', 'reviewer'],
  defaultSkills: ['typescript', 'testing'],

  // Custom prompts
  prdPrompt: 'Focus on user stories...',
  taskPrompt: 'Break into small, testable tasks...',
} satisfies ProjectConfig
```

---

## CLI Entry Point (`src/index.ts`)

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
  .name('haloop')
  .description('Central hub for managing Claude Code missions')
  .version('0.0.1')

program
  .command('init')
  .description('Initialize Haloop on this machine')
  .option('--force', 'Reinitialize even if exists')
  .action(initCommand)

program
  .command('link [path]')
  .description('Link a project to Haloop')
  .option('--name <name>', 'Custom project name')
  .action(linkCommand)

program
  .command('unlink [path]')
  .description('Unlink a project from Haloop')
  .option('--remove-dir', 'Remove .haloop directory')
  .option('--hard', 'Permanently delete from database')
  .action(unlinkCommand)

program
  .command('start')
  .description('Start the Haloop backend server')
  .option('--port <port>', 'Override port')
  .option('--daemon', 'Run in background')
  .option('--verbose', 'Show detailed logs')
  .action(startCommand)

program
  .command('stop')
  .description('Stop the Haloop backend server')
  .action(stopCommand)

program
  .command('status')
  .description('Show Haloop status and linked projects')
  .option('--json', 'Output as JSON')
  .action(statusCommand)

program.parse()
```

---

## Testing Strategy

### Test Setup (`tests/setup.ts`)

```typescript
import { vi } from 'vitest'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

let testDir: string

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'haloop-test-'))
  vi.stubEnv('HALOOP_HOME', testDir)
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await rm(testDir, { recursive: true, force: true })
})

export { testDir }
```

### Test Categories

1. **Path Tests** - Verify path resolution with different HALOOP_HOME values
2. **Config Tests** - Load, save, validate config files
3. **Command Tests** - Each command with success/error scenarios
4. **Integration Tests** - Full init → link → status flow

### Example Test (`commands/init.test.ts`)

```typescript
import { describe, it, expect, vi } from 'vitest'
import { existsSync } from 'fs'
import { join } from 'path'
import { initCommand } from '../../src/commands/init'
import { HALOOP_HOME, GLOBAL_CONFIG_PATH, GLOBAL_DB_PATH } from '../../src/lib/paths'

describe('init command', () => {
  it('creates .haloop directory', async () => {
    await initCommand({ force: false })

    expect(existsSync(HALOOP_HOME)).toBe(true)
    expect(existsSync(GLOBAL_CONFIG_PATH)).toBe(true)
    expect(existsSync(GLOBAL_DB_PATH)).toBe(true)
  })

  it('skips if already initialized', async () => {
    await initCommand({ force: false })
    const result = await initCommand({ force: false })

    expect(result.alreadyInitialized).toBe(true)
  })

  it('reinitializes with --force', async () => {
    await initCommand({ force: false })
    const result = await initCommand({ force: true })

    expect(result.reinitialized).toBe(true)
  })
})
```

---

## Acceptance Criteria

### init
- [ ] Creates `~/.haloop/` directory
- [ ] Creates valid `config.json` with defaults
- [ ] Initializes SQLite database with schema
- [ ] Idempotent (safe to run multiple times)
- [ ] `--force` recreates everything

### link
- [ ] Creates `<project>/.haloop/` directory
- [ ] Registers project in database
- [ ] Detects already-linked projects
- [ ] Warns if not a git repository
- [ ] Custom name via `--name`

### unlink
- [ ] Soft-deletes project (sets inactive)
- [ ] `--hard` permanently deletes
- [ ] `--remove-dir` cleans up directory

### start
- [ ] Starts server on configured port
- [ ] Saves PID for daemon mode
- [ ] Prevents duplicate instances
- [ ] Shows helpful error if port in use

### stop
- [ ] Gracefully stops server
- [ ] Cleans up PID file
- [ ] No error if already stopped

### status
- [ ] Shows initialization state
- [ ] Shows server running/stopped
- [ ] Lists all linked projects with mission counts
- [ ] `--json` outputs valid JSON

### General
- [ ] All commands provide helpful error messages
- [ ] Exit codes: 0 success, 1 error
- [ ] Colored output with chalk
- [ ] Spinners for long operations with ora
