# Haloop Implementation Plan

## Overview
Build Haloop - a central hub for managing Claude Code missions across multiple projects. This MVP focuses on CLI + Backend (frontend later).

**Stack:** pnpm monorepo, Express + better-sqlite3, TypeScript, Vitest

---

## Architecture

```
packages/
  shared/     # @haloop/shared - Types & enums
  cli/        # haloop - Global CLI (npm install -g)
  backend/    # @haloop/backend - Express REST API
```

**Global Instance:** `~/.haloop/`
- `haloop.sqlite` - Projects registry, missions, tasks, logs
- `config.json` - Global settings (ports, auth path)

**Per-Project:** `<project>/.haloop/`
- `config.ts` - Project-specific settings
- `missions/[id]/PRD.md, tasks.json, progress.txt`

---

## Implementation Phases

### Phase 1: Monorepo Setup
**Files to create:**
- `/home/sam/projects/haloop/tsconfig.base.json` - Shared TS config
- `/home/sam/projects/haloop/vitest.workspace.ts` - Vitest workspace config
- Update `/home/sam/projects/haloop/pnpm-workspace.yaml`

**Root package.json:**
```json
{
  "name": "haloop-monorepo",
  "private": true,
  "scripts": {
    "build": "pnpm -r build",
    "dev": "pnpm -r --parallel dev",
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint packages/*/src --ext .ts",
    "clean": "pnpm -r clean"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "typescript": "^5.3.3",
    "vitest": "^2.1.0",
    "@vitest/coverage-v8": "^2.1.0",
    "eslint": "^8.56.0",
    "@typescript-eslint/eslint-plugin": "^6.19.0",
    "@typescript-eslint/parser": "^6.19.0"
  }
}
```

**vitest.workspace.ts:**
```typescript
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  'packages/shared',
  'packages/cli',
  'packages/backend'
])
``` 

### Phase 2: Shared Types (@haloop/shared)
**Files to create:**
```
packages/shared/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts
    types/
      enums.ts      # MissionStatus, TaskStatus, LogLevel
      project.ts    # Project, ProjectConfig
      mission.ts    # Mission, MissionCreateInput, MissionUpdateInput
      task.ts       # Task, TaskCreateInput
      api.ts        # ApiResponse, ApiError, LogEntry
  tests/
    types.test.ts   # Type guard and enum tests
```

**package.json:**
```json
{
  "name": "@haloop/shared",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "typescript": "^5.3.3"
  }
}
```

**vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node'
  }
})
```

**Key Types:**
```typescript
enum MissionStatus {
  DRAFT = 'draft',
  GENERATING_PRD = 'generating_prd',
  PRD_REVIEW = 'prd_review',
  PREPARING_TASKS = 'preparing_tasks',
  TASKS_REVIEW = 'tasks_review',
  IN_PROGRESS = 'in_progress',
  COMPLETED_SUCCESS = 'completed_success',
  COMPLETED_FAILED = 'completed_failed'
}

interface Mission {
  mission_id: string
  project_id: string
  name: string
  status: MissionStatus
  branchName: string | null
  draftContent: string
  prdContent: string | null
  prdIterations: number
  tasksIterations: number
  createdAt: string
  updatedAt: string
  startedAt: string | null
  completedAt: string | null
  containerId: string | null
  worktreePath: string | null
}
```

### Phase 3: CLI Package (haloop)
**Files to create:**
```
packages/cli/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts          # Commander.js entry
    lib/
      paths.ts        # HALOOP_HOME, GLOBAL_DB_PATH, etc.
      config.ts       # loadGlobalConfig
    commands/
      init.ts         # Create ~/.haloop, init SQLite
      link.ts         # Register project, create .haloop/
      start.ts        # Start backend server
      status.ts       # Show linked projects
  tests/
    paths.test.ts     # Path resolution tests
    config.test.ts    # Config loading tests
    commands/
      init.test.ts    # Init command tests
      link.test.ts    # Link command tests
```

**package.json:**
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

**vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts']
  }
})
```

**CLI Commands:**
| Command | Action |
|---------|--------|
| `haloop init` | Create ~/.haloop/, init SQLite, save config |
| `haloop link` | Register project in DB, create .haloop/ dir |
| `haloop start` | Start Express backend server |
| `haloop status` | List linked projects |

### Phase 4: Backend Package (@haloop/backend)
**Files to create:**
```
packages/backend/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts              # Exports
    server.ts             # Express app factory
    database/
      schema.ts           # CREATE TABLE statements
      connection.ts       # getDatabase(), closeDatabase()
    routes/
      index.ts            # Mount all routers
      projects.ts
      missions.ts
      tasks.ts
      logs.ts
    services/
      orchestrator.ts     # Claude Code runner
      mission-executor.ts # PRD/task generation, execution
    middleware/
      error-handler.ts
      logger.ts
  tests/
    setup.ts              # Test database setup/teardown
    database/
      connection.test.ts  # Database connection tests
      schema.test.ts      # Schema validation tests
    routes/
      projects.test.ts    # Projects API tests
      missions.test.ts    # Missions API tests
      tasks.test.ts       # Tasks API tests
    services/
      orchestrator.test.ts      # Orchestrator unit tests
      mission-executor.test.ts  # Mission executor tests
```

**package.json:**
```json
{
  "name": "@haloop/backend",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js",
    "test": "vitest",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@haloop/shared": "workspace:*",
    "better-sqlite3": "^11.0.0",
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "helmet": "^7.1.0",
    "uuid": "^9.0.1",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.8",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/uuid": "^9.0.7",
    "supertest": "^6.3.4",
    "@types/supertest": "^6.0.2",
    "typescript": "^5.3.3"
  }
}
```

**vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/**/*.integration.test.ts']
  }
})
```

**Database Schema:**
- `projects` - id, name, path, created_at, updated_at, is_active
- `missions` - id, project_id, name, status, branch_name, draft_content, prd_content, iterations, timestamps
- `tasks` - id, mission_id, category, description, order, status, agents, skills, steps_to_verify, passes, output
- `logs` - id, mission_id, level, message, timestamp, metadata

### Phase 5: API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects` | GET/POST | List/create projects |
| `/api/projects/:id` | GET/PATCH/DELETE | Project CRUD |
| `/api/missions` | GET/POST | List/create missions |
| `/api/missions/:id` | GET/PATCH/DELETE | Mission CRUD |
| `/api/missions/:id/generate-prd` | POST | Generate PRD from draft |
| `/api/missions/:id/generate-tasks` | POST | Generate tasks from PRD |
| `/api/missions/:id/start` | POST | Start mission execution |
| `/api/missions/:id/stop` | POST | Stop mission execution |
| `/api/tasks` | GET | List tasks (filter by missionId) |
| `/api/tasks/:id` | GET/PATCH | Task details/update |
| `/api/logs` | GET | Get logs (filter by missionId) |

### Phase 6: Orchestrator & Mission Executor

**Orchestrator** (`services/orchestrator.ts`):
- Spawns Claude Code process with prompts
- Captures stdout/stderr
- Emits log events
- Supports stop/kill

**MissionExecutor** (`services/mission-executor.ts`):
- `generatePRD(missionId)` - Run Claude to create PRD from draft
- `generateTasks(missionId)` - Run Claude to break PRD into tasks
- `startMission(missionId)` - Execute tasks sequentially
- `stopMission(missionId)` - Kill active orchestrator
- Saves artifacts to `.haloop/missions/[featureName]/`

---

## Testing Strategy

### Unit Tests (Vitest)
Run from root with workspace support:
```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test --watch

# Run tests with coverage
pnpm test:coverage

# Run tests for specific package
pnpm --filter @haloop/backend test
pnpm --filter @haloop/shared test
pnpm --filter haloop test
```

### Test Categories

**@haloop/shared:**
- Type guard validation
- Enum value tests
- Zod schema validation

**haloop (CLI):**
- Path resolution (home dir, project dirs)
- Config loading/saving
- Command argument parsing
- Mock filesystem operations

**@haloop/backend:**
- Database CRUD operations (in-memory SQLite)
- Route handlers with supertest
- Service layer unit tests
- Orchestrator process spawning (mocked)
- Mission state machine transitions

### Test Setup Files

**packages/cli/tests/setup.ts:**
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
```

**packages/backend/tests/setup.ts:**
```typescript
import { vi } from 'vitest'
import Database from 'better-sqlite3'
import { initSchema } from '../src/database/schema'

let testDb: Database.Database

beforeEach(() => {
  testDb = new Database(':memory:')
  initSchema(testDb)
  vi.stubGlobal('getDatabase', () => testDb)
})

afterEach(() => {
  testDb.close()
  vi.unstubAllGlobals()
})

export { testDb }
```

---

## Verification

### Development Flow:
```bash
# 1. Install dependencies
pnpm install

# 2. Run tests first
pnpm test:run

# 3. Build all packages
pnpm build

# 4. Link CLI globally
cd packages/cli && pnpm link --global

# 5. Initialize Haloop
haloop init

# 6. Link a test project
cd /path/to/test-project && haloop link

# 7. Check status
haloop status

# 8. Start server
haloop start

# 9. Test API
curl http://localhost:3847/health
curl http://localhost:3847/api/projects

# 10. Create mission via API
curl -X POST http://localhost:3847/api/missions \
  -H "Content-Type: application/json" \
  -d '{"projectId":"<id>","name":"Test","draftContent":"Add login button"}'

# 11. Generate PRD
curl -X POST http://localhost:3847/api/missions/<id>/generate-prd

# 12. Generate tasks
curl -X POST http://localhost:3847/api/missions/<id>/generate-tasks

# 13. Start execution
curl -X POST http://localhost:3847/api/missions/<id>/start
```

---

