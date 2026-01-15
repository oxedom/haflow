# Ralphy Hub Backend - Comprehensive PRD & Technical Blueprint

**Version:** 1.0
**Last Updated:** 2026-01-15
**Status:** Implementation Ready

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [User Personas & Use Cases](#3-user-personas--use-cases)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [System Architecture Overview](#6-system-architecture-overview)
7. [Technical Stack](#7-technical-stack)
8. [API Design Summary](#8-api-design-summary)
9. [Data Model Overview](#9-data-model-overview)
10. [Logging, Monitoring & Recovery Strategy](#10-logging-monitoring--recovery-strategy)
11. [Security & Isolation Model](#11-security--isolation-model)
12. [Repository Structure](#12-repository-structure)
13. [Future Extensions & Scalability Notes](#13-future-extensions--scalability-notes)

---

## 1. Product Overview

### What is Ralphy Hub?

**Ralphy Hub** is an API-first orchestration server designed to manage AI-driven software development missions. It serves as the central nervous system for coordinating long-running Claude Code sessions that autonomously develop software features across multiple projects.

### Core Concept

Each "mission" represents a complete AI-assisted development cycle:

```
Draft Request → PRD Generation → Task Breakdown → Code Execution → Testing → Completion
```

The Hub orchestrates this entire lifecycle while:
- **Persisting state** durably in SQLite to survive crashes and restarts
- **Streaming logs** in real-time via Server-Sent Events (SSE)
- **Isolating execution** in Docker containers for safety
- **Tracking progress** with full observability and audit trails

### Key Value Propositions

1. **Durability**: Missions survive hub restarts and system crashes
2. **Observability**: Complete visibility into every process, log, and state transition
3. **Safety**: AI-generated code runs in isolated Docker sandboxes
4. **Simplicity**: No Redis, no Kubernetes - just Node.js, SQLite, and Docker
5. **Single-User Focus**: Optimized for personal developer tooling, not multi-tenant SaaS

### Target Deployment

- **Primary**: Developer's local machine (localhost)
- **Secondary**: Personal VPS accessible via Tailscale/LAN
- **Concurrency**: ~10 simultaneous missions
- **Users**: Single authenticated user

---

## 2. Goals & Non-Goals

### Goals

| ID | Goal | Success Criteria |
|----|------|------------------|
| G1 | **Durable Job Orchestration** | Missions persist across hub restarts; containers reattach automatically |
| G2 | **Real-Time Observability** | All process output streams live via SSE within 100ms latency |
| G3 | **Safe Code Execution** | All untrusted/AI-generated code runs exclusively in Docker containers |
| G4 | **Complete Audit Trail** | Every state change, command, and output is logged and queryable |
| G5 | **Crash Recovery** | Hub reconciles DB state with running processes on startup |
| G6 | **Simple Deployment** | Single `npm start` command; no external dependencies except Docker |
| G7 | **Git Workflow Integration** | Automatic worktree creation, branch management, and PR support |
| G8 | **Resource Control** | CPU/memory limits per mission; concurrency caps at ~10 missions |

### Non-Goals

| ID | Non-Goal | Rationale |
|----|----------|-----------|
| NG1 | Multi-user authentication | Single-user tool; simple token auth suffices |
| NG2 | Horizontal scaling | 10 missions don't require distributed architecture |
| NG3 | External message broker | SQLite queue is sufficient; Redis adds complexity |
| NG4 | Kubernetes orchestration | Docker Compose at most; k8s is overkill |
| NG5 | Real-time collaboration | No simultaneous multi-user editing |
| NG6 | Built-in CI/CD | Defer to existing CI systems (GitHub Actions, etc.) |
| NG7 | Mobile-native app | Responsive web SPA sufficient for mobile access |
| NG8 | Offline AI execution | Claude API always requires network |

---

## 3. User Personas & Use Cases

### Primary Persona: Solo Developer

**Name:** Alex the Autonomous Developer
**Profile:** Full-stack developer who wants to delegate feature development to AI while retaining oversight and control.

**Pain Points:**
- Manually babysitting long-running Claude sessions
- Losing context when terminal crashes or machine restarts
- Risk of AI-generated code breaking the host system
- No visibility into what the AI is doing in real-time

**Goals:**
- Fire off a feature request and walk away
- Review PRDs and task plans before execution starts
- Monitor progress from phone while away from desk
- Trust that the AI can't break anything outside the project

### Use Cases

#### UC1: Create and Execute a Mission

**Actor:** Developer
**Precondition:** Project is linked to Ralphy Hub
**Flow:**
1. Developer sends POST `/missions` with feature description
2. Hub creates mission in `draft` state
3. Hub spawns Claude to generate PRD (state: `generating_prd`)
4. Claude completes; mission moves to `prd_review`
5. Developer reviews PRD via API/UI
6. Developer approves PRD
7. Hub spawns Claude to generate tasks (state: `preparing_tasks`)
8. Claude completes; mission moves to `tasks_review`
9. Developer approves tasks
10. Hub creates Docker container and executes tasks (state: `in_progress`)
11. All tasks succeed; mission completes (state: `completed_success`)
12. Developer creates PR from completed branch

#### UC2: Recover from Hub Crash

**Actor:** System
**Precondition:** Hub crashed with missions in-flight
**Flow:**
1. Hub restarts and loads DB state
2. Hub queries Docker for containers with `ralphy.mission` labels
3. For each running container, hub reattaches to logs stream
4. For each exited container, hub checks exit code and updates mission state
5. For orphaned processes (no container), hub marks mission as `failed`
6. Hub emits recovery audit log entry

#### UC3: Cancel a Running Mission

**Actor:** Developer
**Precondition:** Mission in `in_progress` state
**Flow:**
1. Developer sends POST `/missions/:id/cancel`
2. Hub sends SIGTERM to container
3. After 10s grace period, hub sends SIGKILL if still running
4. Hub marks all related processes as `canceled`
5. Mission state transitions to `completed_failed` with reason "User cancelled"

#### UC4: Stream Live Logs

**Actor:** Developer (via UI or CLI)
**Flow:**
1. Client opens EventSource to `GET /processes/:id/logs/stream`
2. Hub sets SSE headers and begins streaming
3. As process outputs data, hub pipes to both file and SSE clients
4. Client reconnects if connection drops; uses `Last-Event-Id` to resume
5. When process exits, hub sends final SSE event and closes stream

---

## 4. Functional Requirements

### FR1: Project Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1.1 | Link local directory as project | P0 |
| FR1.2 | Unlink project (fail if missions active) | P0 |
| FR1.3 | List all projects with mission counts | P0 |
| FR1.4 | Store project-specific config (optional `config.ts`) | P1 |
| FR1.5 | Validate project path exists and is git repo | P1 |

### FR2: Mission Lifecycle

| ID | Requirement | Priority |
|----|-------------|----------|
| FR2.1 | Create mission from draft content | P0 |
| FR2.2 | Generate PRD via Claude API/CLI | P0 |
| FR2.3 | Store PRD revisions with version numbers | P0 |
| FR2.4 | Allow PRD approval/rejection with notes | P0 |
| FR2.5 | Generate task list via Claude | P0 |
| FR2.6 | Store task revisions with version numbers | P0 |
| FR2.7 | Allow task list approval/rejection | P0 |
| FR2.8 | Execute tasks sequentially in Docker | P0 |
| FR2.9 | Track mission state transitions | P0 |
| FR2.10 | Cancel running mission gracefully | P0 |
| FR2.11 | Mark mission complete (success/failed) | P0 |

### FR3: Process Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR3.1 | Spawn child processes with stdout/stderr capture | P0 |
| FR3.2 | Spawn Docker containers with volume mounts | P0 |
| FR3.3 | Track PID/container ID per process | P0 |
| FR3.4 | Send signals to processes (SIGTERM, SIGKILL) | P0 |
| FR3.5 | Detect process exit and capture exit code | P0 |
| FR3.6 | Kill entire process tree on cancellation | P0 |
| FR3.7 | Reattach to orphaned containers on restart | P0 |

### FR4: Logging & Streaming

| ID | Requirement | Priority |
|----|-------------|----------|
| FR4.1 | Write all process output to log files | P0 |
| FR4.2 | Stream output via SSE in real-time | P0 |
| FR4.3 | Support SSE reconnection with Last-Event-Id | P1 |
| FR4.4 | Rotate log files at configurable size threshold | P1 |
| FR4.5 | Compress old log files | P2 |
| FR4.6 | Maintain in-memory ring buffer (last 100 lines) | P2 |

### FR5: Git Integration

| ID | Requirement | Priority |
|----|-------------|----------|
| FR5.1 | Create git worktree per mission | P0 |
| FR5.2 | Create feature branch (`ralphy/feature/<name>`) | P0 |
| FR5.3 | Commit changes after successful execution | P0 |
| FR5.4 | Push branch to remote | P1 |
| FR5.5 | Create Pull Request via GitHub API | P1 |
| FR5.6 | Clean up stale git locks on startup | P1 |
| FR5.7 | Prune orphaned worktrees | P1 |

### FR6: Persistence & Recovery

| ID | Requirement | Priority |
|----|-------------|----------|
| FR6.1 | Persist all state in SQLite | P0 |
| FR6.2 | Use WAL mode for crash resilience | P0 |
| FR6.3 | Reconcile DB with OS/Docker state on startup | P0 |
| FR6.4 | Mark orphaned running processes as failed | P0 |
| FR6.5 | Reattach to surviving Docker containers | P0 |
| FR6.6 | Write audit log entries for all state changes | P1 |

---

## 5. Non-Functional Requirements

### Reliability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR1.1 | Mission state survives hub restart | 100% |
| NFR1.2 | Container reattachment success rate | >95% |
| NFR1.3 | Zero data loss on graceful shutdown | 100% |
| NFR1.4 | Recovery time after crash | <10 seconds |

### Security

| ID | Requirement | Target |
|----|-------------|--------|
| NFR2.1 | All untrusted code in Docker | 100% |
| NFR2.2 | API requires Bearer token | 100% |
| NFR2.3 | Default bind to localhost only | Default |
| NFR2.4 | Secrets never written to logs | 100% |
| NFR2.5 | Container runs as non-root | Default |

### Observability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR3.1 | SSE log streaming latency | <100ms |
| NFR3.2 | All state changes logged | 100% |
| NFR3.3 | Process CPU/memory stats available | Per-request |
| NFR3.4 | Context usage tracking for Claude | Per-mission |

### Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR4.1 | Concurrent mission support | 10 |
| NFR4.2 | API response time (non-streaming) | <200ms |
| NFR4.3 | Log throughput | 10MB/s aggregate |
| NFR4.4 | Database query time | <50ms |

### Scalability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR5.1 | Missions before performance degrades | 100+ |
| NFR5.2 | Log retention | Unlimited (with rotation) |
| NFR5.3 | Database size before compaction | 1GB |

---

## 6. System Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              RALPHY HUB                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        Express.js REST API                              ││
│  │  /projects  /missions  /processes  /logs  /health                       ││
│  └────────────────────────────┬────────────────────────────────────────────┘│
│                               │                                              │
│  ┌────────────────────────────┼────────────────────────────────────────────┐│
│  │              SERVICE LAYER │                                            ││
│  │  ┌─────────────────────────┴───────────────────────────────────────┐   ││
│  │  │                    MISSION EXECUTOR                              │   ││
│  │  │  • State machine enforcement                                     │   ││
│  │  │  • PRD/Task generation coordination                              │   ││
│  │  │  • Task execution orchestration                                  │   ││
│  │  └─────────────────────────┬───────────────────────────────────────┘   ││
│  │                            │                                            ││
│  │  ┌─────────────────────────┼───────────────────────────────────────┐   ││
│  │  │                    ORCHESTRATOR                                  │   ││
│  │  │  • Child process spawning                                        │   ││
│  │  │  • Docker container management                                   │   ││
│  │  │  • Process lifecycle tracking                                    │   ││
│  │  │  • Signal handling (SIGTERM/SIGKILL)                             │   ││
│  │  └─────────────────────────┬───────────────────────────────────────┘   ││
│  │                            │                                            ││
│  │  ┌─────────────────────────┼───────────────────────────────────────┐   ││
│  │  │                    LOG MANAGER                                   │   ││
│  │  │  • File stream writers                                           │   ││
│  │  │  • SSE broadcast to clients                                      │   ││
│  │  │  • Ring buffer for recent lines                                  │   ││
│  │  └─────────────────────────┴───────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                               │                                              │
│  ┌────────────────────────────┼────────────────────────────────────────────┐│
│  │              PERSISTENCE   │                                            ││
│  │                            ▼                                            ││
│  │  ┌──────────────────────────────────────────────────────────────────┐  ││
│  │  │                     SQLite (WAL Mode)                             │  ││
│  │  │  projects | missions | processes | logs | artifacts | audit      │  ││
│  │  └──────────────────────────────────────────────────────────────────┘  ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐         ┌─────────────────┐         ┌─────────────────┐
│ Docker Engine │         │   Git Repos     │         │  Claude API     │
│               │         │                 │         │                 │
│ • Containers  │         │ • Main repo     │         │ • PRD generation│
│ • Volumes     │         │ • Worktrees     │         │ • Task planning │
│ • Networks    │         │ • Branches      │         │ • Code review   │
└───────────────┘         └─────────────────┘         └─────────────────┘
```

### Mission State Machine

```
                                    ┌─────────────────┐
                                    │      draft      │
                                    └────────┬────────┘
                                             │ start()
                                             ▼
                    ┌────────────────────────────────────────────┐
                    │             generating_prd                  │
                    │     [Claude generates PRD document]         │
                    └────────────────────┬───────────────────────┘
                                         │ success
                                         ▼
     reject + notes ┌────────────────────────────────────────────┐
    ┌──────────────▶│               prd_review                    │
    │               │       [User reviews PRD]                    │
    │               └────────────────────┬───────────────────────┘
    │                                    │ approve()
    │               ┌────────────────────┴───────────────────────┐
    └───────────────│            generating_prd                   │
                    │        (regenerate with feedback)           │
                    └────────────────────────────────────────────┘
                                         │
                                         ▼
                    ┌────────────────────────────────────────────┐
                    │            preparing_tasks                  │
                    │   [Claude generates task breakdown]         │
                    └────────────────────┬───────────────────────┘
                                         │ success
                                         ▼
     reject + notes ┌────────────────────────────────────────────┐
    ┌──────────────▶│              tasks_review                   │
    │               │       [User reviews tasks]                  │
    │               └────────────────────┬───────────────────────┘
    │                                    │ approve()
    │               ┌────────────────────┴───────────────────────┐
    └───────────────│           preparing_tasks                   │
                    │        (regenerate with feedback)           │
                    └────────────────────────────────────────────┘
                                         │
                                         ▼
                    ┌────────────────────────────────────────────┐
                    │              in_progress                    │
                    │   [Docker container executing tasks]        │
                    └───────────┬────────────────────┬───────────┘
                                │                    │
                      all pass  │                    │ failure/cancel
                                ▼                    ▼
                    ┌───────────────────┐  ┌─────────────────────┐
                    │ completed_success │  │  completed_failed   │
                    └───────────────────┘  └─────────────────────┘
```

### Process Flow: What Runs Where

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HOST (Node.js Hub)                                 │
│                                                                              │
│  RUNS ON HOST:                                                               │
│  ├── Express API Server                                                      │
│  ├── Claude API Calls (PRD/Task generation)                                  │
│  ├── Git Operations (worktree, commit, push)                                 │
│  ├── SQLite Database                                                         │
│  ├── SSE Log Streaming                                                       │
│  └── Docker Container Management                                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ docker run / docker exec
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     DOCKER CONTAINER (per mission)                           │
│                                                                              │
│  RUNS IN CONTAINER:                                                          │
│  ├── pnpm install / npm install                                              │
│  ├── pnpm build / npm run build                                              │
│  ├── pnpm test / npm test                                                    │
│  ├── TypeScript compilation                                                  │
│  ├── Linting / Formatting                                                    │
│  ├── Dev server (with port mapping)                                          │
│  └── Any AI-generated scripts                                                │
│                                                                              │
│  MOUNTED VOLUMES:                                                            │
│  └── /workspace → <project>/.ralphy/missions/<id>/worktree                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Technical Stack

### Core Technologies

| Component | Technology | Version | Rationale |
|-----------|------------|---------|-----------|
| **Runtime** | Node.js | 18+ LTS | Async I/O, mature ecosystem, TypeScript support |
| **Language** | TypeScript | 5.3+ | Type safety, better DX, catches errors at compile time |
| **Web Framework** | Express.js | 4.18+ | Simple, well-documented, extensive middleware |
| **Database** | SQLite | 3.x | Zero-config, file-based, ACID, WAL mode |
| **Containers** | Docker | 24+ | Industry standard isolation, cross-platform |

### Key Libraries

| Library | Purpose | Why This Choice |
|---------|---------|-----------------|
| **better-sqlite3** | SQLite driver | Synchronous API (simpler), fast, native bindings |
| **dockerode** | Docker SDK | Programmatic container management, stream support |
| **zod** | Schema validation | TypeScript-first, runtime type checking |
| **pino** | Logging | Fast structured logging, low overhead |
| **uuid** | ID generation | RFC4122 compliant, collision-resistant |
| **execa** | Process spawning | Promise-based, tree-kill, cross-platform |
| **tree-kill** | Process cleanup | Kill entire process trees cross-platform |
| **helmet** | Security headers | OWASP best practices out of the box |
| **cors** | CORS handling | Required for browser-based clients |

### Development Tools

| Tool | Purpose |
|------|---------|
| **Vitest** | Unit/integration testing |
| **supertest** | HTTP endpoint testing |
| **tsx** | TypeScript execution for development |
| **esbuild** | Fast TypeScript compilation |
| **pnpm** | Package management |

### Infrastructure Requirements

| Requirement | Specification |
|-------------|---------------|
| **Node.js** | v18.x or v20.x LTS |
| **Docker** | Engine 24+ with API access |
| **Disk Space** | 10GB+ for logs and containers |
| **Memory** | 2GB+ for hub + containers |
| **Network** | Outbound for Claude API, npm registry |

---

## 8. API Design Summary

### Base URL & Authentication

```
Base URL: http://localhost:3000/api
Auth Header: Authorization: Bearer <token>
Content-Type: application/json
```

### Projects API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/projects` | Link a new project |
| `GET` | `/projects` | List all projects |
| `GET` | `/projects/:id` | Get project details |
| `PATCH` | `/projects/:id` | Update project metadata |
| `DELETE` | `/projects/:id` | Unlink project |

**Create Project Request:**
```json
{
  "path": "/home/user/my-repo",
  "name": "My Repo"
}
```

**Create Project Response (201):**
```json
{
  "id": "proj_abc123",
  "name": "My Repo",
  "path": "/home/user/my-repo",
  "status": "linked",
  "missionsCount": 0,
  "createdAt": "2026-01-15T10:00:00Z"
}
```

### Missions API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/missions` | Create new mission |
| `GET` | `/missions` | List missions (filter by `?projectId=`) |
| `GET` | `/missions/:id` | Get mission details + timeline |
| `PATCH` | `/missions/:id` | Update mission (draft, notes) |
| `DELETE` | `/missions/:id` | Delete mission (if not running) |

**Mission Actions:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/missions/:id/start` | Start mission from draft |
| `POST` | `/missions/:id/prd/approve` | Approve PRD, generate tasks |
| `POST` | `/missions/:id/prd/reject` | Reject PRD with feedback |
| `POST` | `/missions/:id/tasks/approve` | Approve tasks, start execution |
| `POST` | `/missions/:id/tasks/reject` | Reject tasks with feedback |
| `POST` | `/missions/:id/cancel` | Cancel running mission |
| `POST` | `/missions/:id/complete` | Create PR from completed mission |

**Create Mission Request:**
```json
{
  "projectId": "proj_abc123",
  "featureName": "add-login",
  "description": "Implement user authentication with JWT",
  "draft": "User story: As a user, I want to log in..."
}
```

**Mission Status Response:**
```json
{
  "id": "mission_xyz789",
  "projectId": "proj_abc123",
  "featureName": "add-login",
  "state": "prd_review",
  "branchName": "ralphy/feature/add-login",
  "worktreePath": "/home/user/my-repo/.ralphy/missions/add-login/worktree",
  "prdVersion": 2,
  "tasksVersion": 0,
  "timeline": [
    {"state": "draft", "enteredAt": "...", "exitedAt": "..."},
    {"state": "generating_prd", "startedAt": "...", "endedAt": "...", "processId": "proc_001"},
    {"state": "prd_review", "enteredAt": "...", "feedback": "Needs more detail on error handling"}
  ],
  "createdAt": "2026-01-15T10:00:00Z",
  "updatedAt": "2026-01-15T10:30:00Z"
}
```

### Processes API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/processes` | Start arbitrary process (admin) |
| `GET` | `/processes` | List processes (filter by `?missionId=`) |
| `GET` | `/processes/:id` | Get process details |
| `GET` | `/processes/:id/logs` | Get complete log output |
| `GET` | `/processes/:id/logs/stream` | **SSE** Live log stream |
| `POST` | `/processes/:id/signal` | Send signal (SIGTERM, SIGKILL) |
| `POST` | `/processes/:id/cleanup` | Remove container/temp files |

**SSE Log Stream:**
```
GET /api/processes/proc_001/logs/stream

Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

retry: 10000
id: 1
data: Starting pnpm install...

id: 2
data: Packages: +523 -12

id: 3
data: Done in 5.2s
```

### Context Usage API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/missions/:id/context-usage` | Claude context usage per phase |

**Response:**
```json
{
  "missionId": "mission_xyz789",
  "phases": [
    {"phase": "prd_generation", "promptTokens": 8000, "responseTokens": 2000, "contextUsed": 10000},
    {"phase": "task_generation", "promptTokens": 5000, "responseTokens": 1500, "contextUsed": 6500}
  ],
  "totalTokens": 16500
}
```

### Health & Utility

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/metrics` | Prometheus metrics (optional) |

---

## 9. Data Model Overview

### Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────────┐       ┌─────────────┐
│  projects   │───┬──▶│    missions     │───┬──▶│   tasks     │
└─────────────┘   │   └─────────────────┘   │   └─────────────┘
                  │           │             │
                  │           │             │   ┌─────────────┐
                  │           │             └──▶│  processes  │
                  │           │                 └─────────────┘
                  │           │
                  │           │   ┌─────────────────────┐
                  │           └──▶│  mission_revisions  │
                  │               └─────────────────────┘
                  │
                  │               ┌─────────────┐
                  └──────────────▶│    logs     │
                                  └─────────────┘

                                  ┌─────────────┐
                                  │  audit_log  │ (global)
                                  └─────────────┘
```

### SQLite Schema

```sql
-- Enable WAL mode for crash resilience
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

-- Projects: Linked repositories
CREATE TABLE projects (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    path            TEXT NOT NULL UNIQUE,
    is_active       INTEGER DEFAULT 1,
    config          TEXT,  -- JSON: project-specific settings
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_projects_path ON projects(path);
CREATE INDEX idx_projects_active ON projects(is_active);

-- Missions: Development loops
CREATE TABLE missions (
    id                  TEXT PRIMARY KEY,
    project_id          TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    feature_name        TEXT NOT NULL,
    state               TEXT NOT NULL DEFAULT 'draft',
    draft_content       TEXT NOT NULL,
    prd_content         TEXT,
    branch_name         TEXT,
    worktree_path       TEXT,
    container_id        TEXT,
    prd_iterations      INTEGER DEFAULT 0,
    tasks_iterations    INTEGER DEFAULT 0,
    result              TEXT,  -- 'success', 'failed', 'canceled'
    failure_reason      TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
    started_at          TEXT,
    completed_at        TEXT
);

CREATE INDEX idx_missions_project ON missions(project_id);
CREATE INDEX idx_missions_state ON missions(state);
CREATE INDEX idx_missions_branch ON missions(branch_name);

-- Mission Revisions: PRD and Task list versions
CREATE TABLE mission_revisions (
    id              TEXT PRIMARY KEY,
    mission_id      TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    type            TEXT NOT NULL CHECK (type IN ('prd', 'tasks')),
    version         INTEGER NOT NULL,
    content         TEXT NOT NULL,
    notes           TEXT,  -- Rejection feedback
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(mission_id, type, version)
);

CREATE INDEX idx_revisions_mission ON mission_revisions(mission_id);
CREATE INDEX idx_revisions_type ON mission_revisions(type);

-- Tasks: Individual work items
CREATE TABLE tasks (
    id              TEXT PRIMARY KEY,
    mission_id      TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    category        TEXT NOT NULL,
    description     TEXT NOT NULL,
    order_num       INTEGER NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    agents          TEXT,  -- JSON array: ['coder', 'tester']
    skills          TEXT,  -- JSON array: ['typescript', 'testing']
    steps_to_verify TEXT,  -- JSON array of verification steps
    passes          INTEGER DEFAULT 0,
    output          TEXT,
    started_at      TEXT,
    completed_at    TEXT
);

CREATE INDEX idx_tasks_mission ON tasks(mission_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_order ON tasks(mission_id, order_num);

-- Processes: Running/completed executions
CREATE TABLE processes (
    id              TEXT PRIMARY KEY,
    mission_id      TEXT REFERENCES missions(id) ON DELETE SET NULL,
    type            TEXT NOT NULL,  -- 'claude', 'build', 'test', 'git', etc.
    command         TEXT NOT NULL,
    cwd             TEXT,
    pid             INTEGER,
    pgid            INTEGER,
    container_id    TEXT,
    status          TEXT NOT NULL DEFAULT 'queued',
    exit_code       INTEGER,
    log_path        TEXT,
    started_at      TEXT,
    ended_at        TEXT,
    heartbeat_at    TEXT
);

CREATE INDEX idx_processes_mission ON processes(mission_id);
CREATE INDEX idx_processes_status ON processes(status);
CREATE INDEX idx_processes_container ON processes(container_id);

-- Logs: Mission-level log entries
CREATE TABLE logs (
    id              TEXT PRIMARY KEY,
    mission_id      TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    level           TEXT NOT NULL DEFAULT 'info',
    message         TEXT NOT NULL,
    metadata        TEXT,  -- JSON
    timestamp       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_logs_mission ON logs(mission_id);
CREATE INDEX idx_logs_level ON logs(level);
CREATE INDEX idx_logs_timestamp ON logs(timestamp);

-- Artifacts: Files/commits/PRs produced
CREATE TABLE artifacts (
    id              TEXT PRIMARY KEY,
    mission_id      TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    type            TEXT NOT NULL,  -- 'file', 'commit', 'pr', 'report'
    path            TEXT,
    description     TEXT,
    metadata        TEXT,  -- JSON: commit hash, PR URL, etc.
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_artifacts_mission ON artifacts(mission_id);
CREATE INDEX idx_artifacts_type ON artifacts(type);

-- Audit Log: Global event tracking
CREATE TABLE audit_log (
    id              TEXT PRIMARY KEY,
    event           TEXT NOT NULL,
    entity_type     TEXT,
    entity_id       TEXT,
    details         TEXT,  -- JSON
    timestamp       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_audit_event ON audit_log(event);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
```

### State Enums

```typescript
// Mission States
enum MissionState {
  DRAFT = 'draft',
  GENERATING_PRD = 'generating_prd',
  PRD_REVIEW = 'prd_review',
  PREPARING_TASKS = 'preparing_tasks',
  TASKS_REVIEW = 'tasks_review',
  IN_PROGRESS = 'in_progress',
  COMPLETED_SUCCESS = 'completed_success',
  COMPLETED_FAILED = 'completed_failed'
}

// Task States
enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped'
}

// Process States
enum ProcessStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  SUCCESS = 'success',
  ERROR = 'error',
  CANCELED = 'canceled'
}

// Log Levels
enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}
```

---

## 10. Logging, Monitoring & Recovery Strategy

### Log Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LOG FLOW                                            │
│                                                                              │
│   Process stdout/stderr                                                      │
│           │                                                                  │
│           ▼                                                                  │
│   ┌───────────────────┐                                                      │
│   │   Log Manager     │                                                      │
│   │                   │                                                      │
│   │ ├─▶ File Writer ──┼──▶ logs/<mission>/<process>.log                     │
│   │ │                 │                                                      │
│   │ ├─▶ SSE Clients ──┼──▶ Real-time browser streams                        │
│   │ │                 │                                                      │
│   │ └─▶ Ring Buffer ──┼──▶ Last 100 lines in memory                         │
│   │                   │                                                      │
│   └───────────────────┘                                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Log File Structure

```
~/.ralphy/
├── ralphy.sqlite                    # Central database
├── hub.log                          # Hub's own structured logs (Pino)
└── logs/
    └── missions/
        └── <mission-id>/
            ├── progress.txt         # Human-readable mission narrative
            ├── process_001.log      # Claude PRD generation output
            ├── process_002.log      # Task generation output
            ├── process_003.log      # Build output
            └── process_004.log      # Test output

<project>/.ralphy/
└── missions/
    └── <feature-name>/
        ├── PRD.md                   # Latest PRD document
        ├── PRD.v1.md                # Previous PRD versions
        ├── tasks.json               # Task breakdown
        └── worktree/                # Git worktree directory
```

### Capture Strategy

**Non-blocking Stdout/Stderr Capture:**
```typescript
const child = spawn(command, args, { stdio: 'pipe' });

child.stdout.on('data', (chunk: Buffer) => {
  logFile.write(chunk);           // Persist immediately
  broadcastSSE(processId, chunk); // Stream to clients
  ringBuffer.push(chunk);         // Keep recent lines
});

child.stderr.on('data', (chunk: Buffer) => {
  logFile.write(`[STDERR] ${chunk}`);
  broadcastSSE(processId, chunk);
  ringBuffer.push(chunk);
});
```

**Rotation Policy:**
- Rotate at 10MB per file
- Keep rotated files with timestamp suffix
- Compress files older than 24 hours (gzip)
- Never auto-delete (user manages retention)

### SSE Implementation

```typescript
// SSE endpoint handler
app.get('/processes/:id/logs/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send retry interval
  res.write('retry: 10000\n\n');

  // Resume from Last-Event-Id if provided
  const lastId = req.headers['last-event-id'];
  if (lastId) {
    sendMissedEvents(res, processId, parseInt(lastId));
  }

  // Register client
  sseClients.get(processId)?.add(res);

  // Cleanup on disconnect
  req.on('close', () => {
    sseClients.get(processId)?.delete(res);
  });
});
```

### Monitoring Metrics

**Process Metrics (via pidusage/dockerode):**
- CPU usage percentage
- RSS memory usage
- Process uptime
- Exit codes

**Hub Metrics (via /metrics endpoint):**
```
# HELP ralphy_missions_total Total missions created
# TYPE ralphy_missions_total counter
ralphy_missions_total{status="success"} 42
ralphy_missions_total{status="failed"} 3

# HELP ralphy_processes_active Currently running processes
# TYPE ralphy_processes_active gauge
ralphy_processes_active 2

# HELP ralphy_mission_duration_seconds Mission completion time
# TYPE ralphy_mission_duration_seconds histogram
ralphy_mission_duration_seconds_bucket{le="60"} 5
ralphy_mission_duration_seconds_bucket{le="300"} 15
```

### Recovery Strategy

**On Hub Startup:**

```typescript
async function reconcileState(): Promise<void> {
  logger.info('Starting state reconciliation...');

  // 1. Find all missions in running states
  const runningMissions = db.query(`
    SELECT * FROM missions
    WHERE state IN ('generating_prd', 'preparing_tasks', 'in_progress')
  `);

  // 2. For each mission, check associated processes
  for (const mission of runningMissions) {
    const processes = db.query(`
      SELECT * FROM processes
      WHERE mission_id = ? AND status = 'running'
    `, [mission.id]);

    for (const proc of processes) {
      if (proc.container_id) {
        // Check Docker container status
        const container = docker.getContainer(proc.container_id);
        const info = await container.inspect().catch(() => null);

        if (!info) {
          // Container gone - mark as failed
          markProcessFailed(proc.id, 'Container not found after restart');
        } else if (info.State.Running) {
          // Reattach to logs
          await reattachToContainer(proc.id, container);
        } else {
          // Container exited - capture exit code
          const exitCode = info.State.ExitCode;
          markProcessComplete(proc.id, exitCode);
        }
      } else if (proc.pid) {
        // Check OS process (likely dead after hub restart)
        if (!isProcessAlive(proc.pid)) {
          markProcessFailed(proc.id, 'Process died during hub restart');
        }
      }
    }

    // Update mission state based on process outcomes
    reconcileMissionState(mission.id);
  }

  // 3. Clean up orphaned Docker containers
  const orphanedContainers = await docker.listContainers({
    filters: { label: ['ralphy.mission'] }
  });

  for (const container of orphanedContainers) {
    const missionId = container.Labels['ralphy.mission'];
    const exists = db.query('SELECT 1 FROM missions WHERE id = ?', [missionId]);
    if (!exists.length) {
      await docker.getContainer(container.Id).remove({ force: true });
      logger.warn(`Removed orphaned container ${container.Id}`);
    }
  }

  logger.info('Reconciliation complete');
}
```

---

## 11. Security & Isolation Model

### Network Security

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        NETWORK TOPOLOGY                                      │
│                                                                              │
│   Default (Localhost Only):                                                  │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │  localhost:3000 ◀──── Browser/CLI                                  │    │
│   │       │                                                            │    │
│   │       ▼                                                            │    │
│   │  Hub API (Express)                                                 │    │
│   │       │                                                            │    │
│   │       ├──▶ Docker containers (NAT network)                         │    │
│   │       │         └── Port mappings: localhost:XXXX:3000             │    │
│   │       │                                                            │    │
│   │       └──▶ Claude API (outbound HTTPS)                             │    │
│   └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│   LAN/Tailscale (Explicit Opt-in):                                          │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │  0.0.0.0:3000 + Bearer Token Auth                                  │    │
│   │       │                                                            │    │
│   │       ▼                                                            │    │
│   │  Hub API ◀──── Mobile/Remote Browser                               │    │
│   └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Authentication

```typescript
// Simple Bearer token middleware
function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.slice(7);
  const expectedToken = process.env.RALPHY_API_TOKEN;

  if (!expectedToken) {
    // No token configured = allow all (localhost-only assumed)
    return next();
  }

  if (!timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken))) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  next();
}
```

### Docker Isolation Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     CONTAINER SECURITY                                       │
│                                                                              │
│   Container Configuration:                                                   │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │  Image:        node:18-alpine (minimal)                            │    │
│   │  User:         --user $(id -u):$(id -g)  (non-root)                │    │
│   │  Init:         --init  (tini for signal handling)                  │    │
│   │  Network:      bridge (NAT, outbound only by default)              │    │
│   │  Memory:       --memory=1g  (limit per container)                  │    │
│   │  CPU:          --cpus=1.0  (limit per container)                   │    │
│   │  PID Limit:    --pids-limit=100  (prevent fork bombs)              │    │
│   │  Read-only:    Selected paths only                                 │    │
│   │  No Privileged:--privileged=false                                  │    │
│   │  No Docker:    No /var/run/docker.sock mount                       │    │
│   └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│   Volume Mounts:                                                             │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │  ALLOWED:                                                          │    │
│   │  ├── Project worktree → /workspace (rw)                            │    │
│   │  └── npm cache → /root/.npm (rw, optional)                         │    │
│   │                                                                    │    │
│   │  FORBIDDEN:                                                        │    │
│   │  ├── Home directory                                                │    │
│   │  ├── SSH keys                                                      │    │
│   │  ├── Docker socket                                                 │    │
│   │  └── Any path outside project                                      │    │
│   └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Command Allowlist

```typescript
const ALLOWED_COMMANDS = new Set([
  // Package managers
  'pnpm', 'npm', 'yarn', 'bun',
  // Build tools
  'node', 'npx', 'tsc', 'esbuild',
  // Testing
  'vitest', 'jest', 'mocha',
  // Linting
  'eslint', 'prettier',
  // Git (run on host, not container)
  'git',
]);

function validateCommand(command: string): boolean {
  const baseCmd = command.split(' ')[0];
  return ALLOWED_COMMANDS.has(baseCmd);
}
```

### Secret Management

```typescript
// Secrets never passed to containers or logged
const REDACTED_ENV_KEYS = [
  'CLAUDE_API_KEY',
  'ANTHROPIC_API_KEY',
  'GITHUB_TOKEN',
  'GIT_CREDENTIALS',
  'RALPHY_API_TOKEN',
];

function sanitizeEnvForLogging(env: Record<string, string>): Record<string, string> {
  const sanitized = { ...env };
  for (const key of REDACTED_ENV_KEYS) {
    if (sanitized[key]) {
      sanitized[key] = '<REDACTED>';
    }
  }
  return sanitized;
}
```

---

## 12. Repository Structure

### Full Tree View

```
packages/backend/
├── src/
│   ├── index.ts                      # Entry point: starts server
│   ├── server.ts                     # Express app configuration
│   ├── config.ts                     # Configuration loading & validation
│   │
│   ├── database/
│   │   ├── index.ts                  # Database connection & initialization
│   │   ├── schema.ts                 # SQLite schema DDL
│   │   ├── migrations.ts             # Schema migration utilities
│   │   └── repositories/
│   │       ├── index.ts              # Repository exports
│   │       ├── projects.ts           # Project CRUD operations
│   │       ├── missions.ts           # Mission CRUD & state transitions
│   │       ├── tasks.ts              # Task CRUD operations
│   │       ├── processes.ts          # Process tracking
│   │       ├── logs.ts               # Log entry management
│   │       ├── artifacts.ts          # Artifact storage
│   │       └── audit.ts              # Audit log entries
│   │
│   ├── routes/
│   │   ├── index.ts                  # Route aggregation
│   │   ├── projects.ts               # /api/projects endpoints
│   │   ├── missions.ts               # /api/missions endpoints
│   │   ├── tasks.ts                  # /api/tasks endpoints
│   │   ├── processes.ts              # /api/processes endpoints
│   │   ├── logs.ts                   # /api/logs endpoints
│   │   └── health.ts                 # /health endpoint
│   │
│   ├── services/
│   │   ├── index.ts                  # Service exports
│   │   ├── orchestrator.ts           # Process spawning & management
│   │   ├── mission-executor.ts       # Mission lifecycle coordination
│   │   ├── docker-manager.ts         # Container lifecycle management
│   │   ├── git-manager.ts            # Git worktree & branch operations
│   │   ├── log-manager.ts            # Log streaming & file management
│   │   ├── sse-manager.ts            # SSE client tracking & broadcasting
│   │   ├── claude-client.ts          # Claude API integration
│   │   └── recovery.ts               # Startup reconciliation
│   │
│   ├── middleware/
│   │   ├── index.ts                  # Middleware exports
│   │   ├── auth.ts                   # Bearer token authentication
│   │   ├── error-handler.ts          # Global error handling
│   │   ├── logger.ts                 # Request logging (Pino)
│   │   └── validation.ts             # Zod schema validation
│   │
│   ├── types/
│   │   ├── index.ts                  # Type exports
│   │   ├── api.ts                    # API request/response types
│   │   ├── database.ts               # Database row types
│   │   ├── docker.ts                 # Docker-related types
│   │   └── events.ts                 # Internal event types
│   │
│   └── utils/
│       ├── index.ts                  # Utility exports
│       ├── id.ts                     # UUID generation
│       ├── paths.ts                  # Path utilities
│       ├── process.ts                # Process utilities (tree-kill)
│       ├── sanitize.ts               # Input sanitization
│       └── validators.ts             # Zod schemas
│
├── tests/
│   ├── setup.ts                      # Test setup (in-memory DB)
│   ├── fixtures/                     # Test data fixtures
│   │   ├── projects.ts
│   │   ├── missions.ts
│   │   └── processes.ts
│   ├── unit/
│   │   ├── services/
│   │   │   ├── orchestrator.test.ts
│   │   │   ├── mission-executor.test.ts
│   │   │   ├── docker-manager.test.ts
│   │   │   └── git-manager.test.ts
│   │   └── repositories/
│   │       ├── projects.test.ts
│   │       ├── missions.test.ts
│   │       └── tasks.test.ts
│   ├── integration/
│   │   ├── routes/
│   │   │   ├── projects.test.ts
│   │   │   ├── missions.test.ts
│   │   │   └── processes.test.ts
│   │   └── flows/
│   │       ├── mission-lifecycle.test.ts
│   │       └── recovery.test.ts
│   └── e2e/
│       └── full-mission.test.ts
│
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

### Key Files Explained

#### Entry Points

**`src/index.ts`** - Application Entry
```typescript
// Loads config, initializes DB, starts server
import { createServer } from './server';
import { initializeDatabase } from './database';
import { runRecovery } from './services/recovery';
import { config } from './config';

async function main() {
  await initializeDatabase();
  await runRecovery();
  const app = createServer();
  app.listen(config.port, config.host);
}

main();
```

**`src/server.ts`** - Express Configuration
```typescript
// Configures Express with middleware and routes
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/error-handler';
import { routes } from './routes';

export function createServer() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(authMiddleware);

  app.use('/api', routes);
  app.use(errorHandler);

  return app;
}
```

#### Database Layer

**`src/database/schema.ts`** - DDL Definitions
```typescript
// Contains all CREATE TABLE statements
export const SCHEMA_SQL = `
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS projects (...);
  CREATE TABLE IF NOT EXISTS missions (...);
  // ... all tables
`;

export function initSchema(db: Database): void {
  db.exec(SCHEMA_SQL);
}
```

**`src/database/repositories/missions.ts`** - Mission Repository
```typescript
// Mission CRUD with state machine validation
export class MissionRepository {
  constructor(private db: Database) {}

  create(data: CreateMissionDTO): Mission { ... }
  findById(id: string): Mission | null { ... }
  updateState(id: string, newState: MissionState): void {
    // Validate state transition before updating
    const current = this.findById(id);
    if (!isValidTransition(current.state, newState)) {
      throw new InvalidStateTransitionError(current.state, newState);
    }
    // Update...
  }
}
```

#### Services Layer

**`src/services/orchestrator.ts`** - Process Spawning
```typescript
// Singleton orchestrator for process management
export class Orchestrator {
  private processes = new Map<string, ChildProcess | Container>();

  async spawnLocal(options: SpawnOptions): Promise<string> {
    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      stdio: 'pipe',
      detached: process.platform !== 'win32',
    });

    // Track process
    const id = generateId('proc');
    this.processes.set(id, child);

    // Wire up logging
    child.stdout?.on('data', (data) => {
      this.emit('stdout', { processId: id, data });
    });

    return id;
  }

  async spawnInDocker(options: DockerSpawnOptions): Promise<string> { ... }

  async kill(processId: string): Promise<void> { ... }
}

// Singleton export
let instance: Orchestrator | null = null;
export function getOrchestrator(): Orchestrator {
  if (!instance) instance = new Orchestrator();
  return instance;
}
```

**`src/services/mission-executor.ts`** - Lifecycle Coordination
```typescript
// Coordinates mission phases
export class MissionExecutor {
  constructor(
    private orchestrator: Orchestrator,
    private missionRepo: MissionRepository,
    private claudeClient: ClaudeClient,
    private dockerManager: DockerManager,
    private gitManager: GitManager,
  ) {}

  async generatePRD(missionId: string): Promise<void> {
    const mission = this.missionRepo.findById(missionId);
    this.missionRepo.updateState(missionId, 'generating_prd');

    const prompt = buildPRDPrompt(mission.draftContent);
    const processId = await this.orchestrator.spawnLocal({
      command: 'claude',
      args: ['-p', prompt],
      cwd: mission.worktreePath,
    });

    // Wait for completion, capture output...
  }

  async startExecution(missionId: string): Promise<void> {
    const mission = this.missionRepo.findById(missionId);

    // Create Docker container
    const containerId = await this.dockerManager.createContainer({
      image: 'node:18-alpine',
      workdir: '/workspace',
      mounts: [{ host: mission.worktreePath, container: '/workspace' }],
      labels: { 'ralphy.mission': missionId },
    });

    // Execute tasks sequentially
    const tasks = this.taskRepo.findByMission(missionId);
    for (const task of tasks) {
      await this.executeTask(task, containerId);
    }
  }
}
```

**`src/services/docker-manager.ts`** - Container Management
```typescript
// Docker container lifecycle
export class DockerManager {
  private docker = new Docker();

  async createContainer(options: ContainerOptions): Promise<string> {
    const container = await this.docker.createContainer({
      Image: options.image,
      Cmd: options.cmd,
      WorkingDir: options.workdir,
      Labels: { ...options.labels, 'ralphy.managed': 'true' },
      HostConfig: {
        Binds: options.mounts.map(m => `${m.host}:${m.container}`),
        Memory: 1 * 1024 * 1024 * 1024, // 1GB
        CpuPeriod: 100000,
        CpuQuota: 100000, // 1 CPU
        PidsLimit: 100,
        Init: true,
      },
    });

    return container.id;
  }

  async exec(containerId: string, cmd: string[]): Promise<ExecResult> { ... }

  async attachToLogs(containerId: string, callback: LogCallback): Promise<void> {
    const container = this.docker.getContainer(containerId);
    const stream = await container.logs({ follow: true, stdout: true, stderr: true });
    stream.on('data', (chunk) => callback(chunk.toString()));
  }

  async stop(containerId: string): Promise<void> { ... }
  async remove(containerId: string): Promise<void> { ... }
}
```

**`src/services/sse-manager.ts`** - SSE Broadcasting
```typescript
// Manages SSE client connections
export class SSEManager {
  private clients = new Map<string, Set<Response>>();

  addClient(processId: string, res: Response): void {
    if (!this.clients.has(processId)) {
      this.clients.set(processId, new Set());
    }
    this.clients.get(processId)!.add(res);

    // Setup SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.write('retry: 10000\n\n');
  }

  removeClient(processId: string, res: Response): void {
    this.clients.get(processId)?.delete(res);
  }

  broadcast(processId: string, eventId: number, data: string): void {
    const clients = this.clients.get(processId);
    if (!clients) return;

    for (const client of clients) {
      client.write(`id: ${eventId}\n`);
      client.write(`data: ${data}\n\n`);
    }
  }
}
```

**`src/services/recovery.ts`** - Startup Reconciliation
```typescript
// Reconciles state on hub restart
export async function runRecovery(): Promise<void> {
  const logger = getLogger('recovery');
  logger.info('Starting state reconciliation...');

  // 1. Find running missions
  const runningMissions = missionRepo.findByStates([
    'generating_prd', 'preparing_tasks', 'in_progress'
  ]);

  // 2. Check each mission's processes
  for (const mission of runningMissions) {
    const processes = processRepo.findRunningByMission(mission.id);

    for (const proc of processes) {
      if (proc.containerId) {
        await reconcileContainer(proc);
      } else {
        await reconcileLocalProcess(proc);
      }
    }
  }

  // 3. Clean up orphaned containers
  await cleanupOrphanedContainers();

  logger.info('Reconciliation complete');
}
```

#### Routes Layer

**`src/routes/missions.ts`** - Mission Endpoints
```typescript
import { Router } from 'express';
import { validateBody } from '../middleware/validation';
import { CreateMissionSchema, ApproveSchema, RejectSchema } from '../utils/validators';

export const missionsRouter = Router();

// POST /api/missions
missionsRouter.post('/', validateBody(CreateMissionSchema), async (req, res) => {
  const mission = await missionService.create(req.body);
  res.status(201).json(mission);
});

// GET /api/missions/:id
missionsRouter.get('/:id', async (req, res) => {
  const mission = await missionService.getById(req.params.id);
  if (!mission) return res.status(404).json({ error: 'Mission not found' });
  res.json(mission);
});

// POST /api/missions/:id/prd/approve
missionsRouter.post('/:id/prd/approve', async (req, res) => {
  await missionExecutor.approvePRD(req.params.id);
  res.json({ status: 'ok' });
});

// POST /api/missions/:id/prd/reject
missionsRouter.post('/:id/prd/reject', validateBody(RejectSchema), async (req, res) => {
  await missionExecutor.rejectPRD(req.params.id, req.body.notes);
  res.json({ status: 'ok' });
});

// ... more endpoints
```

#### Middleware Layer

**`src/middleware/error-handler.ts`** - Global Error Handler
```typescript
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const logger = getLogger('http');

  if (err instanceof ValidationError) {
    res.status(400).json({ error: 'Validation failed', details: err.issues });
    return;
  }

  if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message });
    return;
  }

  if (err instanceof InvalidStateTransitionError) {
    res.status(409).json({ error: err.message });
    return;
  }

  // Unexpected error
  logger.error({ err, req: req.url }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
}
```

---

## 13. Future Extensions & Scalability Notes

### Phase 2 Extensions (Post-MVP)

| Feature | Description | Complexity |
|---------|-------------|------------|
| **Notifications** | ntfy.sh/webhook integration for mission events | Low |
| **PR Auto-creation** | GitHub/GitLab API integration for PR workflows | Medium |
| **Context Visualization** | Charts showing Claude token usage over time | Low |
| **Multi-project Dashboard** | Aggregated view of all missions across projects | Medium |
| **Mission Templates** | Reusable PRD/task templates for common features | Medium |

### Scalability Path (If Needed)

**From 10 to 50 Concurrent Missions:**
```
Current: Single Node.js process + SQLite
    │
    ▼
Step 1: Connection pooling for SQLite (better-sqlite3-pool)
    │
    ▼
Step 2: Multiple Express workers (cluster module)
    │
    ▼
Step 3: SSE clients offloaded to dedicated process
```

**From 50 to 200+ Missions (Unlikely Needed):**
```
Step 4: Replace SQLite with PostgreSQL
    │
    ▼
Step 5: Replace in-process job queue with BullMQ + Redis
    │
    ▼
Step 6: Horizontal scaling with load balancer
```

### Technology Upgrade Path

| Current | Future Option | Trigger Condition |
|---------|---------------|-------------------|
| SQLite | PostgreSQL | >1GB database, need concurrent writes |
| Express | Fastify | Need better performance, schema validation |
| child_process | PM2 API | Need process persistence across hub restarts |
| Single Node | Cluster | CPU bottleneck from 50+ concurrent missions |

### API Versioning Strategy

```
/api/v1/missions     # Current stable
/api/v2/missions     # Future breaking changes

# Version header alternative:
Accept: application/vnd.ralphy.v1+json
```

### Plugin Architecture (Future)

```typescript
// Future: Plugin interface for custom task executors
interface TaskExecutorPlugin {
  name: string;
  canExecute(task: Task): boolean;
  execute(task: Task, context: ExecutionContext): Promise<TaskResult>;
}

// Example plugins:
// - PythonExecutor: Run Python scripts
// - RustExecutor: Cargo build/test
// - GoExecutor: go build/test
```

### Multi-User Considerations (Out of Scope)

If multi-user support ever becomes necessary:
1. Replace Bearer token with JWT + user claims
2. Add `user_id` foreign key to projects/missions
3. Implement row-level security in repositories
4. Add rate limiting per user
5. Tenant isolation for Docker containers

This is explicitly **not planned** and would require significant architectural changes.

---

## Appendix A: Configuration Reference

```typescript
// Environment variables
interface Config {
  // Server
  PORT: number;              // Default: 3000
  HOST: string;              // Default: '127.0.0.1'

  // Authentication
  RALPHY_API_TOKEN?: string; // Optional Bearer token

  // Database
  RALPHY_HOME: string;       // Default: ~/.ralphy
  DATABASE_PATH: string;     // Default: $RALPHY_HOME/ralphy.sqlite

  // Docker
  DOCKER_SOCKET: string;     // Default: /var/run/docker.sock
  DOCKER_IMAGE: string;      // Default: node:18-alpine
  CONTAINER_MEMORY_MB: number; // Default: 1024
  CONTAINER_CPU_LIMIT: number; // Default: 1.0

  // Concurrency
  MAX_CONCURRENT_MISSIONS: number; // Default: 10

  // Logging
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error'; // Default: 'info'
  LOG_ROTATION_SIZE_MB: number; // Default: 10

  // Claude
  CLAUDE_API_KEY?: string;
  CLAUDE_MODEL: string;      // Default: claude-3-opus
}
```

---

## Appendix B: Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `ERR_NOT_FOUND` | 404 | Resource not found |
| `ERR_VALIDATION` | 400 | Request validation failed |
| `ERR_INVALID_STATE` | 409 | Invalid state transition |
| `ERR_MISSION_ACTIVE` | 400 | Cannot delete project with active missions |
| `ERR_PROCESS_RUNNING` | 400 | Cannot delete running process |
| `ERR_DOCKER_UNAVAILABLE` | 503 | Docker daemon not accessible |
| `ERR_GIT_CONFLICT` | 409 | Git operation failed (lock, merge conflict) |
| `ERR_UNAUTHORIZED` | 401 | Missing or invalid auth token |

---

**End of Document**

*This PRD serves as the authoritative reference for Ralphy Hub backend implementation. All implementation should adhere to the specifications outlined herein.*
