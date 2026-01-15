# Product Requirements Document: Ralphy

## 1. Executive Summary

**Product Name:** Ralphy
**Version:** 1.0
**Document Status:** Draft

Ralphy is a local "Mission Control" application for AI-driven software development. It orchestrates Claude Code to generate PRDs, breakdown tasks, and execute code within sandboxed environments. The system enables developers to manage multiple AI-assisted development missions across projects from a central hub.

---

## 2. Problem Statement

Developers using AI coding assistants like Claude Code lack a structured workflow for:
- Managing multiple AI-driven development tasks across projects
- Isolating untrusted AI-generated code execution
- Tracking mission progress through defined lifecycle stages
- Capturing and reviewing AI execution logs in real-time

Ralphy addresses these gaps by providing orchestration, sandboxing, and state management for AI development workflows.

---

## 3. Goals and Objectives

### Primary Goals
1. **Orchestration**: Centrally manage Claude Code executions across multiple projects
2. **Isolation**: Execute untrusted AI-generated code in Docker sandboxes
3. **Traceability**: Capture all AI interactions and outputs with structured logging
4. **Workflow Management**: Guide missions through defined lifecycle stages

### Success Criteria
- Successfully register and manage multiple projects
- Create missions that progress through all lifecycle stages
- Stream real-time logs via SSE to clients
- Execute code safely within Docker containers

---

## 4. User Stories

### Project Management
| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-01 | Developer | Initialize Ralphy on my machine | I can start using the orchestration system |
| US-02 | Developer | Link my project to Ralphy | Ralphy can manage missions for that project |
| US-03 | Developer | View all linked projects | I can see what's being managed |
| US-04 | Developer | Unlink a project | I can remove projects I no longer need tracked |

### Mission Management
| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-05 | Developer | Create a new mission for a feature | I can start AI-assisted development |
| US-06 | Developer | Generate a PRD for my mission | I have documented requirements before coding |
| US-07 | Developer | Review and approve the generated PRD | I control what gets implemented |
| US-08 | Developer | Break down the PRD into tasks | Work is organized into executable units |
| US-09 | Developer | Execute tasks in seriall via ralph.sh | The feature is implemented step by step |
| US-10 | Developer | View mission status and progress | I know where things stand |

### Execution & Monitoring
| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-11 | Developer | Stream live logs from Claude execution | I can monitor AI progress in real-time |
| US-12 | Developer | Run tests in a sandboxed environment | Untrusted code doesn't affect my system |
| US-13 | Developer | Stop a running mission | I can halt execution if something goes wrong |

---

## 5. Functional Requirements

### 5.1 CLI Module (`@ralphy/cli`)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-CLI-01 | `ralphy init` creates `~/.ralphy/` directory and initializes SQLite database | P0 |
| FR-CLI-02 | `ralphy link [path]` registers current/specified directory to projects table | P0 |
| FR-CLI-03 | `ralphy unlink [path]` removes project from registration | P1 |
| FR-CLI-04 | `ralphy start` launches the backend server on configurable port (default: 3847) | P0 |
| FR-CLI-05 | `ralphy stop` gracefully shuts down the backend server | P1 |
| FR-CLI-06 | `ralphy status` displays linked projects and server status | P1 |
| FR-CLI-07 | CLI reads `ralphy.json` from project roots for per-project configuration | P2 |

### 5.2 Backend Module (`@ralphy/backend`)

#### Project Management
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-BE-01 | `GET /api/projects` returns all registered projects | P0 |
| FR-BE-02 | `POST /api/projects` registers a new project | P0 |
| FR-BE-03 | `DELETE /api/projects/:id` unregisters a project | P1 |

#### Mission Management
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-BE-04 | `POST /api/missions` creates a new mission in DRAFT status | P0 |
| FR-BE-05 | `GET /api/missions/:id` returns mission details and current state | P0 |
| FR-BE-06 | `GET /api/missions` returns all missions (filterable by project) | P0 |
| FR-BE-07 | `POST /api/missions/:id/generate-prd` triggers PRD generation | P0 |
| FR-BE-08 | `POST /api/missions/:id/generate-tasks` triggers task breakdown | P0 |
| FR-BE-09 | `POST /api/missions/:id/start` begins task execution | P0 |
| FR-BE-10 | `POST /api/missions/:id/stop` halts mission execution | P1 |

#### Task Management
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-BE-11 | `GET /api/missions/:id/tasks` returns all tasks for a mission | P0 |
| FR-BE-12 | `PATCH /api/tasks/:id` updates task status | P1 |

#### Logging & Streaming
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-BE-13 | `GET /api/missions/:id/logs` returns historical logs | P0 |
| FR-BE-14 | `GET /api/missions/:id/logs/stream` provides SSE stream of real-time logs | P0 |
| FR-BE-15 | Logs are persisted to `<project>/.ralphy/missions/<id>/logs/` | P0 |

### 5.3 Orchestrator Service

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-ORC-01 | Spawn Claude CLI processes via `child_process.spawn` | P0 |
| FR-ORC-02 | Pipe stdout/stderr to file AND SSE stream simultaneously | P0 |
| FR-ORC-03 | Track process state (PID, status) in database | P0 |
| FR-ORC-04 | Support graceful process termination | P1 |
| FR-ORC-05 | Clean up zombie processes on server restart | P2 |

### 5.4 Docker Integration

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-DOC-01 | `runInSandbox(missionId, command)` executes commands in Docker container | P0 |
| FR-DOC-02 | Mount mission worktree as volume in container | P0 |
| FR-DOC-03 | Capture container stdout/stderr to log stream | P0 |
| FR-DOC-04 | Support container lifecycle management (start, stop, cleanup) | P1 |
| FR-DOC-05 | Track container ID in processes table | P0 |

### 5.5 Git Integration

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-GIT-01 | Create git worktrees for missions (`ralphy/feature/<name>`) | P0 |
| FR-GIT-02 | Isolate mission work from main branch | P0 |
| FR-GIT-03 | Store worktree path in mission record | P0 |

---

## 6. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-01 | Performance | SSE log streaming latency < 100ms |
| NFR-02 | Performance | API response time < 200ms for non-streaming endpoints |
| NFR-03 | Reliability | Server survives Claude process crashes without terminating |
| NFR-04 | Reliability | Database operations are transactional |
| NFR-05 | Security | Docker containers have no network access by default |
| NFR-06 | Security | Containers run with minimal privileges |
| NFR-07 | Portability | Works on macOS, Linux, and WSL2 |
| NFR-08 | Storage | Single SQLite file at `~/.ralphy/ralphy.sqlite` |
| NFR-09 | Configuration | `RALPHY_HOME` env var overrides default config location |

---

## 7. Technical Architecture

### 7.1 Technology Stack

| Component | Technology |
|-----------|------------|
| Monorepo | pnpm workspaces |
| Runtime | Node.js (v18+) |
| API Framework | Express.js |
| Database | better-sqlite3 |
| Process Management | Node child_process |
| Containerization | Docker (via CLI) |
| Type Validation | Zod |
| Testing | Vitest |
| Basic Frontend Index.html window.location.hostName is the api url

### 7.2 Package Structure

```
packages/
  shared/   # Types, Zod schemas, Enums
  cli/      # Global CLI commands
  backend/  # REST API + Orchestrator + Docker
  web/      # (Future) Dashboard UI
```

### 7.3 Isolation Strategy

| Layer | Responsibility |
|-------|----------------|
| **Host** | Git operations, Claude API calls, Orchestration logic |
| **Docker** | Untrusted code execution (tests, builds, dev server) |

---

## 8. Data Model

### 8.1 Entity Relationship

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   projects   │──────<│   missions   │──────<│   processes  │
└──────────────┘       └──────────────┘       └──────────────┘
                              │                      │
                              │                      │
                              ▼                      ▼
                       ┌──────────────┐       ┌──────────────┐
                       │    tasks     │       │     logs     │
                       └──────────────┘       └──────────────┘
```

### 8.2 Table Schemas

#### projects
| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY |
| path | TEXT | NOT NULL, UNIQUE |
| name | TEXT | NOT NULL |
| config_json | TEXT | JSON string |
| created_at | TEXT | ISO timestamp |

#### missions
| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY |
| project_id | TEXT | FOREIGN KEY -> projects.id |
| feature_name | TEXT | NOT NULL |
| status | TEXT | MissionStatus enum |
| branch_name | TEXT | |
| worktree_path | TEXT | |
| created_at | TEXT | ISO timestamp |
| updated_at | TEXT | ISO timestamp |

#### tasks
| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY |
| mission_id | TEXT | FOREIGN KEY -> missions.id |
| title | TEXT | NOT NULL |
| description | TEXT | |
| status | TEXT | TaskStatus enum |
| order_index | INTEGER | |
| created_at | TEXT | ISO timestamp |

#### processes
| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY |
| mission_id | TEXT | FOREIGN KEY -> missions.id |
| type | TEXT | 'claude' \| 'test' \| 'docker' |
| pid | INTEGER | |
| container_id | TEXT | |
| status | TEXT | ProcessStatus enum |
| started_at | TEXT | ISO timestamp |
| ended_at | TEXT | ISO timestamp |

#### logs
| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY |
| process_id | TEXT | FOREIGN KEY -> processes.id |
| timestamp | TEXT | ISO timestamp |
| content | TEXT | NOT NULL |
| stream | TEXT | 'stdout' \| 'stderr' |

---

## 9. State Machine: Mission Lifecycle

```
┌─────────┐
│  DRAFT  │ ----> Optional Go for Research and then Generating PRD.
└────┬────┘
     │ POST /missions/:id/generate-prd
     ▼
┌──────────────────┐
│  GENERATING_PRD  │
└────────┬─────────┘
         │ PRD complete
         ▼
┌─────────────┐
│  PRD_REVIEW │ <── User reviews/edits PRD
└──────┬──────┘
       │ POST /missions/:id/generate-tasks
       ▼
┌───────────────────┐
│  PREPARING_TASKS  │
└─────────┬─────────┘
          │ Tasks generated (prd.json file)
          ▼
┌───────────────┐
│ TASKS_REVIEW  │ <── User reviews/edits tasks
└───────┬───────┘
        │ POST /missions/:id/start
        ▼
┌─────────────┐
│ IN_PROGRESS │ <── Tasks executing serially via @ralph.sh
└──────┬──────┘
       │
       ├──────────────────┐
       ▼                  ▼
┌──────────────────┐ ┌────────┐
│ COMPLETED_SUCCESS│ │ FAILED │
└──────────────────┘ └────────┘
```

---

## 10. API Specification Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Health check |
| GET | /api/projects | List all projects |
| POST | /api/projects | Register project |
| DELETE | /api/projects/:id | Unregister project |
| GET | /api/missions | List missions |
| POST | /api/missions | Create mission |
| GET | /api/missions/:id | Get mission details |
| POST | /api/missions/:id/generate-prd | Trigger PRD generation |
| POST | /api/missions/:id/generate-tasks | Trigger task generation |
| POST | /api/missions/:id/start | Start execution |
| POST | /api/missions/:id/stop | Stop execution |
| GET | /api/missions/:id/tasks | List tasks |
| PATCH | /api/tasks/:id | Update task |
| GET | /api/missions/:id/logs | Get historical logs |
| GET | /api/missions/:id/logs/stream | SSE log stream |

---

## 11. Implementation Phases

### Phase 1: Foundation
**Scope:** Monorepo setup and shared types

- Initialize pnpm workspace
- Create `@ralphy/shared` package
- Define TypeScript interfaces: `Project`, `Mission`, `Task`, `Process`, `Log`
- Define enums: `MissionStatus`, `TaskStatus`, `ProcessStatus`, `ProcessType`
- Create Zod schemas for API validation
- Configure build pipeline

### Phase 2: CLI & Local Setup
**Scope:** Project registration and initialization

- Create `@ralphy/cli` package with Commander.js
- Implement `ralphy init` (create ~/.ralphy, init DB schema)
- Implement `ralphy link` (register project)
- Implement `ralphy unlink` (unregister project)
- Implement `ralphy start` (launch server)
- Implement `ralphy stop` (terminate server)
- Implement `ralphy status` (show state)
- Add configuration loading from `ralphy.json`

### Phase 3: Backend Core
**Scope:** REST API and database layer

- Create `@ralphy/backend` package
- Setup Express server with middleware
- Initialize better-sqlite3 database
- Implement project CRUD endpoints
- Implement mission CRUD endpoints
- Implement mission state machine transitions
- Add request validation with Zod

### Phase 4: Orchestrator & Logging
**Scope:** Process management and real-time streaming

- Implement Orchestrator service (singleton)
- Spawn Claude CLI processes with `child_process.spawn`
- Dual-pipe stdout/stderr to file and memory buffer
- Implement SSE endpoint for log streaming
- Track process lifecycle in database
- Handle process cleanup on termination

### Phase 5: Docker Integration
**Scope:** Sandboxed code execution

- Integrate dockerode or Docker CLI
- Implement `runInSandbox(missionId, command)`
- Configure container with worktree volume mount
- Capture container output to log stream
- Implement container lifecycle management
- Add security constraints (no network, limited resources)

### Phase 6: Mission Logic
**Scope:** Claude integration and workflow automation

- Implement git worktree creation helper
- Create `generatePRD()` agent wrapper
- Create `generateTasks()` agent wrapper
- Create `executeTask()` agent wrapper
- Wire up full mission lifecycle automation

---

## 12. Testing Strategy

### Unit Tests (Vitest)
- **@ralphy/shared:** Validate Zod schemas, enum values, type guards
- **@ralphy/backend:** Mock `child_process.spawn` and `better-sqlite3` to test orchestration logic
- **@ralphy/cli:** Test command parsing and option handling

### Integration Tests
- Create mission via API and verify database state
- Verify log files created on disk at correct paths
- Verify Docker container mounts worktree correctly
- Verify SSE stream receives process output

### End-to-End Tests
- Full workflow: init -> link -> create mission -> generate PRD -> execute tasks
- Verify artifacts exist on disk after completion

---

## 13. Verification Checklist

| # | Verification | Status |
|---|--------------|--------|
| 1 | `ralphy init` creates `~/.ralphy/` directory | [ ] |
| 2 | `ralphy init` creates SQLite database with schema | [ ] |
| 3 | `ralphy link` adds project to database | [ ] |
| 4 | `ralphy start` launches server on port 3847 | [ ] |
| 5 | Creating mission creates folder `.ralphy/missions/<id>/` | [ ] |
| 6 | Triggering dummy process streams logs via SSE | [ ] |
| 7 | Docker container mounts worktree correctly | [ ] |
| 8 | Docker container can write files to worktree | [ ] |
| 9 | Mission progresses through all status states | [ ] |
| 10 | Logs persisted to disk match SSE stream | [ ] |

---

## 14. Out of Scope (v1.0)

- Web dashboard UI (`@ralphy/web`)
- Multi-user support / authentication
- Remote server deployment
- Mission branching / parallel task execution
- Cloud storage for logs
- Webhook integrations

---

## 15. Glossary

| Term | Definition |
|------|------------|
| **Mission** | A unit of AI-assisted work, typically implementing a single feature |
| **Task** | An individual work item within a mission |
| **Worktree** | Git worktree isolating mission changes from main branch |
| **Orchestrator** | Service managing Claude CLI process lifecycle |
| **Sandbox** | Docker container for executing untrusted code |

---

## Appendix A: Configuration Schema

### `~/.ralphy/config.json` (Global)
```json
{
  "port": 3847,
  "logLevel": "info",
  "docker": {
    "image": "node:20-slim",
    "networkMode": "none"
  }
}
```

### `<project>/ralphy.json` (Per-Project)
```json
{
  "name": "my-project",
  "claudeModel": "claude-sonnet-4-20250514",
  "testCommand": "pnpm test",
  "buildCommand": "pnpm build"
}
```

---

*Document generated from bb.md specification*
