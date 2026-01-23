# PRD: haflow Backend

## Overview
Backend REST API server for haflow - a central hub for managing Claude Code missions across multiple projects.

**Package:** `@haflow/backend` + `@haflow/shared`
**Stack:** Express, better-sqlite3, TypeScript, Zod, Vitest

---

## Goals
1. Provide REST API for managing projects, missions, tasks, and logs
2. Execute Claude Code processes to generate PRDs and complete tasks
3. Store all data in SQLite database at `~/.haflow/haflow.sqlite`
4. Support concurrent mission execution with proper state management

---

## Phase 1: Monorepo Foundation

### Files to Create
| File | Purpose |
|------|---------|
| `/tsconfig.base.json` | Shared TypeScript configuration |
| `/vitest.workspace.ts` | Vitest workspace config |
| Update `/pnpm-workspace.yaml` | Define package locations |



### vitest.workspace.ts
```typescript
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  'packages/shared',
  'packages/cli',
  'packages/backend'
])
```

---

## Phase 2: Shared Types (@haflow/shared)

### Package Structure
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

### Enums
```typescript
export enum MissionStatus {
  DRAFT = 'draft',
  GENERATING_PRD = 'generating_prd',
  PRD_REVIEW = 'prd_review',
  PREPARING_TASKS = 'preparing_tasks',
  TASKS_REVIEW = 'tasks_review',
  IN_PROGRESS = 'in_progress',
  COMPLETED_SUCCESS = 'completed_success',
  COMPLETED_FAILED = 'completed_failed'
}

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped'
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}
```

### Core Types
```typescript
export interface Project {
  id: string
  name: string
  path: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Mission {
  id: string
  projectId: string
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

export interface Task {
  id: string
  missionId: string
  category: string
  description: string
  order: number
  status: TaskStatus
  agents: string[]
  skills: string[]
  stepsToVerify: string[]
  passes: number
  output: string | null
}

export interface LogEntry {
  id: string
  missionId: string
  level: LogLevel
  message: string
  timestamp: string
  metadata: Record<string, unknown> | null
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: ApiError
}

export interface ApiError {
  code: string
  message: string
  details?: unknown
}
```

### Dependencies
```json
{
  "name": "@haflow/shared",
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
  "devDependencies": {
    "typescript": "^5.3.3"
  }
}
```

---

## Phase 3: Backend Package (@haflow/backend)

### Package Structure
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
    setup.ts
    database/
      connection.test.ts
      schema.test.ts
    routes/
      projects.test.ts
      missions.test.ts
      tasks.test.ts
    services/
      orchestrator.test.ts
      mission-executor.test.ts
```

### Dependencies
```json
{
  "name": "@haflow/backend",
  "version": "0.0.1",
  "type": "module",
  "dependencies": {
    "@haflow/shared": "workspace:*",
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

---

## Phase 4: Database Schema

### Tables

#### projects
| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY |
| name | TEXT | NOT NULL |
| path | TEXT | NOT NULL UNIQUE |
| is_active | INTEGER | DEFAULT 1 |
| created_at | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |

#### missions
| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY |
| project_id | TEXT | NOT NULL, FK → projects.id |
| name | TEXT | NOT NULL |
| status | TEXT | NOT NULL |
| branch_name | TEXT | |
| draft_content | TEXT | NOT NULL |
| prd_content | TEXT | |
| prd_iterations | INTEGER | DEFAULT 0 |
| tasks_iterations | INTEGER | DEFAULT 0 |
| created_at | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |
| started_at | TEXT | |
| completed_at | TEXT | |
| container_id | TEXT | |
| worktree_path | TEXT | |

#### tasks
| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY |
| mission_id | TEXT | NOT NULL, FK → missions.id |
| category | TEXT | NOT NULL |
| description | TEXT | NOT NULL |
| order_num | INTEGER | NOT NULL |
| status | TEXT | NOT NULL |
| agents | TEXT | JSON array |
| skills | TEXT | JSON array |
| steps_to_verify | TEXT | JSON array |
| passes | INTEGER | DEFAULT 0 |
| output | TEXT | |

#### logs
| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY |
| mission_id | TEXT | NOT NULL, FK → missions.id |
| level | TEXT | NOT NULL |
| message | TEXT | NOT NULL |
| timestamp | TEXT | NOT NULL |
| metadata | TEXT | JSON object |

---

## Phase 5: API Endpoints

### Projects
| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| GET | `/api/projects` | List all projects | - | `Project[]` |
| POST | `/api/projects` | Create project | `{ name, path }` | `Project` |
| GET | `/api/projects/:id` | Get project | - | `Project` |
| PATCH | `/api/projects/:id` | Update project | `{ name?, isActive? }` | `Project` |
| DELETE | `/api/projects/:id` | Delete project | - | `{ success: true }` |

### Missions
| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| GET | `/api/missions` | List missions | Query: `projectId?` | `Mission[]` |
| POST | `/api/missions` | Create mission | `{ projectId, name, draftContent }` | `Mission` |
| GET | `/api/missions/:id` | Get mission | - | `Mission` |
| PATCH | `/api/missions/:id` | Update mission | `{ name?, draftContent?, prdContent?, status? }` | `Mission` |
| DELETE | `/api/missions/:id` | Delete mission | - | `{ success: true }` |

### Mission Actions
| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| POST | `/api/missions/:id/generate-prd` | Generate PRD from draft | `Mission` (status: generating_prd) |
| POST | `/api/missions/:id/generate-tasks` | Generate tasks from PRD | `Mission` (status: preparing_tasks) |
| POST | `/api/missions/:id/start` | Start mission execution | `Mission` (status: in_progress) |
| POST | `/api/missions/:id/stop` | Stop mission execution | `Mission` (status: previous or failed) |

### Tasks
| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| GET | `/api/tasks` | List tasks | Query: `missionId` required | `Task[]` |
| GET | `/api/tasks/:id` | Get task | `Task` |
| PATCH | `/api/tasks/:id` | Update task | `{ status?, output? }` | `Task` |

### Logs
| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| GET | `/api/logs` | Get logs | Query: `missionId`, `level?`, `limit?` | `LogEntry[]` |

### Health
| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| GET | `/health` | Health check | `{ status: 'ok', timestamp }` |

---

## Phase 6: Services

### Orchestrator (`services/orchestrator.ts`)
Manages Claude Code process execution.

```typescript
interface OrchestratorOptions {
  cwd: string
  prompt: string
  onStdout?: (data: string) => void
  onStderr?: (data: string) => void
  onExit?: (code: number | null) => void
}

class Orchestrator {
  spawn(options: OrchestratorOptions): ChildProcess
  kill(pid: number): void
  isRunning(pid: number): boolean
}
```

**Responsibilities:**
- Spawn `claude` CLI process with prompts
- Stream stdout/stderr to callbacks
- Track running processes
- Support graceful termination

### MissionExecutor (`services/mission-executor.ts`)
Orchestrates mission lifecycle.

```typescript
class MissionExecutor {
  generatePRD(missionId: string): Promise<void>
  generateTasks(missionId: string): Promise<void>
  startMission(missionId: string): Promise<void>
  stopMission(missionId: string): Promise<void>
}
```

**Responsibilities:**
- Update mission status through state machine
- Run Claude Code with appropriate prompts
- Parse and store PRD content
- Parse and create task records
- Execute tasks sequentially
- Save artifacts to `.haflow/missions/[name]/`
- Log all activity to database

### Mission State Machine
```
draft → generating_prd → prd_review → preparing_tasks → tasks_review → in_progress → completed_success
                                                                                   ↘ completed_failed
```

**Valid Transitions:**
- `draft` → `generating_prd` (via generate-prd)
- `generating_prd` → `prd_review` (on PRD complete)
- `prd_review` → `preparing_tasks` (via generate-tasks)
- `preparing_tasks` → `tasks_review` (on tasks complete)
- `tasks_review` → `in_progress` (via start)
- `in_progress` → `completed_success` | `completed_failed` (on execution end)
- Any state → `draft` (via manual reset)

---

## Testing Strategy

### Test Setup (`tests/setup.ts`)
```typescript
import { vi } from 'vitest'
import Database from 'better-sqlite3'
import { initSchema } from '../src/database/schema'

let testDb: Database.Database

beforeEach(() => {
  testDb = new Database(':memory:')
  initSchema(testDb)
})

afterEach(() => {
  testDb.close()
})

export { testDb }
```

### Test Categories
1. **Database Tests** - Schema creation, CRUD operations
2. **Route Tests** - HTTP endpoints with supertest
3. **Service Tests** - Orchestrator (mocked child_process), MissionExecutor state transitions
4. **Integration Tests** - Full API flow with test database

---

## Acceptance Criteria

### Database
- [ ] Schema creates all tables with correct columns
- [ ] Foreign key constraints enforced
- [ ] JSON columns serialize/deserialize correctly

### API
- [ ] All CRUD endpoints return correct status codes
- [ ] Validation rejects invalid input with 400
- [ ] Not found returns 404
- [ ] Server errors return 500 with error details

### Services
- [ ] Orchestrator spawns and tracks processes
- [ ] MissionExecutor enforces state machine
- [ ] Logs written for all operations
- [ ] Artifacts saved to project `.haflow/` directory

### Tests
- [ ] All unit tests pass
- [ ] Test coverage > 80%
- [ ] Integration tests verify full flows
