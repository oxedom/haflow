## Haloop v0 — "Make It Work" Working Doc (Local Missions + Human Gates + Ephemeral Sandboxes)

### Document Context
- **Date**: 2026-01-23 (updated)
- **Purpose**: Single high-level reference that reflects current repo reality + updated decisions (workflow, CLI, local home dir, sandbox orchestration).
- **Status**: Active (v0 "get end-to-end working") — **Backend + Frontend substantially complete; CLI not started**
- **Audience**:
  - Humans (you/me) as the canonical v0 spec
  - The **Research Agent** (this doc should be actionable input)

---

### Product Goal (v0)
Haloop is a **local-first orchestrator** that runs AI-assisted “missions” against real projects, with **human gates** and **ephemeral sandboxes**.

- **Local UI + Local Backend** only (not a hosted SaaS).
- **Multiple missions in parallel** is a core goal (each mission/run must be isolated; artifacts must never collide).
- **Human-in-the-loop workflow**: unstructured input → AI steps → human approvals/edits → implementation → review.
- **State philosophy**:
  - Durable state is primarily **files on disk** (missions, artifacts, run metadata).
  - “Live state” is derived by querying reality (container status/log tail), then reflected back in mission JSON.
- **UI data model**: **polling** (TanStack Query); **no streaming** required for v0.

---

### Current Repo Reality (Snapshot)

#### Implementation Status Summary

| Package | Status | Notes |
|---------|--------|-------|
| `packages/backend` | ✅ Substantially complete | All 6 API endpoints, mission store, Docker sandbox provider |
| `packages/frontend` | ✅ Fully functional | Polling, artifact editor, mission lifecycle UI |
| `packages/shared` | ✅ Complete | All mission/workflow types defined |
| `packages/cli` | ❌ Not started | Folder exists but empty |

#### packages/backend (~820 LOC)
- **API Server**: Express on port 4000 with CORS
- **Routes** (`src/routes/missions.ts`): All 6 endpoints implemented
- **Mission Store** (`src/services/mission-store.ts`): File-based persistence under `~/.haloop/missions/`
- **Mission Engine** (`src/services/mission-engine.ts`): Workflow orchestration with container monitoring (1s polling)
- **Docker Provider** (`src/services/docker.ts`): Container execution via CLI, label-based tracking, log capture
- **Sandbox Provider** (`src/services/sandbox.ts`): High-level abstraction (k3s-ready interface)
- **Workflow** (`src/services/workflow.ts`): Hardcoded "standard-feature" 8-step workflow
- **Tests**: 9 test files covering services, routes, and Docker integration

**Current limitation**: Agent steps run a **mock command** that copies input to output (no real Claude execution yet).

#### packages/frontend (~1400 LOC)
- **App.tsx**: TanStack Query with `refetchInterval: 2000`, `staleTime: 1000`
- **MissionDetail.tsx**: Workflow timeline, live log tail, artifact editor with diff view
- **API client** (`src/api/client.ts`): Axios client targeting `http://localhost:4000/api`
- **E2E Tests**: Playwright-based tests with global setup/teardown
- **Tech**: React 19, React Compiler, Vite 7, TailwindCSS 4, Radix UI

#### packages/shared
- Types: `MissionType`, `MissionStatus`, `StepType`, `WorkflowStep`, `Workflow`, `MissionMeta`, `StepRun`, `MissionDetail`, `ApiResponse<T>`
- All exported from `src/index.ts`

#### packages/cli
- **Empty** — folder exists but no code

**Current state**: Backend + Frontend can run together directly (no mocks). Full mission flow works end-to-end with mock agent execution. E2E testing infrastructure in place with Playwright.

---

### v0 User Journey (Frontend Reality)
The UI is intentionally simple right now: **missions only** (no project selector yet).

- **Create mission**: user enters `title`, `type`, and a **raw input text blob** in the modal.
  - Raw input initially exists only in the browser.
  - When the user creates a mission, the backend **persists** it as an artifact file (see below).
- **Select mission**: sidebar lists missions and polls them.
- **Mission detail**:
  - Shows a workflow timeline.
  - For “running” statuses, it shows `current_log_tail` as a live-ish log view (via polling).
  - For “waiting_human”, it opens a markdown editor/diff/preview for the step’s `reviewArtifact`.
  - User can **Save Draft** (edits artifact) and/or **Continue** to advance the workflow.

---

### v0 Workflow (Source of Truth = Frontend Mock)
This is the v0 pipeline we ship first (exact artifact names are important because the UI addresses artifacts by filename):

1. **Agent: Cleanup**
   - in: `raw-input.md`
   - out: `structured-text.md`
2. **Human Gate: Review Structured**
   - review: `structured-text.md` (editable)
3. **Agent: Research**
   - in: `structured-text.md`
   - out: `research-output.md`
4. **Human Gate: Review Research**
   - review: `research-output.md` (editable)
5. **Agent: Planning**
   - in: `research-output.md`
   - out: `implementation-plan.md`
6. **Human Gate: Review Plan**
   - review: `implementation-plan.md` (editable)
7. **Agent: Implementation**
   - in: `implementation-plan.md`
   - out: `implementation-result.json`
8. **Human Gate: Review Implementation**
   - review: `implementation-result.json` (editable or at least viewable)

**Important refinement**: the “raw input” is NOT a pre-existing markdown file at mission start.
- It begins as **free text** typed into the browser.
- On mission creation, the backend writes `raw-input.md` into that mission’s artifact folder.

---

### Backend API Contract ✅ IMPLEMENTED

All endpoints implemented in `packages/backend/src/routes/missions.ts`:

| Method | Endpoint | Status | Implementation |
|--------|----------|--------|----------------|
| GET | `/api/missions` | ✅ | Returns `MissionListItem[]` sorted by `updated_at` desc |
| GET | `/api/missions/:missionId` | ✅ | Returns `MissionDetail` with workflow, artifacts, runs, `current_log_tail` |
| POST | `/api/missions` | ✅ | Creates mission folder + `raw-input.md` artifact |
| PUT | `/api/missions/:missionId/artifacts/:filename` | ✅ | Saves artifact content, updates `updated_at` |
| POST | `/api/missions/:missionId/continue` | ✅ | Advances workflow; starts container for agent steps |
| POST | `/api/missions/:missionId/mark-completed` | ✅ | Forces mission to `completed` status |

All responses wrapped in `ApiResponse<T>` (`{ success, data, error }`).

**Transport**: polling only (no SSE/WebSocket/streaming).

---

### Mission & Artifact Storage Model ✅ IMPLEMENTED

Implemented in `packages/backend/src/services/mission-store.ts`.

#### Mission identity
- Mission IDs use **UUID with prefix**: `m-<uuid>` (e.g., `m-abc12345-...`)
- Run IDs use prefix: `r-<uuid>`
- Generated via `packages/backend/src/utils/id.ts`

#### Implemented layout
```
~/.haloop/
  missions/
    m-<uuid>/
      mission.json              # MissionMeta + workflow_id + current_step
      artifacts/
        raw-input.md
        structured-text.md
        research-output.md
        implementation-plan.md
        implementation-result.json
      runs/
        r-<uuid>.json           # StepRun with container_id, timestamps, exit_code
      logs/
        r-<uuid>.log            # Raw stdout/stderr from container
```

#### Implementation notes
- `mission.json` stores `workflow_id: "standard-feature"` (hardcoded workflow for v0)
- Artifacts loaded into memory map on demand for `MissionDetail.artifacts`
- Log tails fetched via `getLogTail()` for `current_log_tail` field
- Runs stored as individual JSON files per step execution

#### Multi-project note (forward-looking)
We will later associate missions with linked projects. For v0, the CLI only supports **one linked project at a time**, which keeps the mental model simple and avoids conflicts. Missions can still be stored flat under `~/.haloop/missions/` and add project scoping later without breaking the UI.

#### Workflow templates (v0)
Workflows are **templates**, not per-mission files:
- **Project-level (optional)**: a `workflows/` folder at the project root for repo-specific templates.
- **Global (preinstalled)**: `~/.haloop/workflows/` for built-in/common templates shipped with Haloop.

Missions just reference which template to use (by ID/name/path) and the backend resolves it at runtime.

---

### Sandbox Runtime ✅ IMPLEMENTED (Docker Provider)

Implemented as two layers:
- **High-level**: `packages/backend/src/services/sandbox.ts` — Provider abstraction (k3s-ready)
- **Docker impl**: `packages/backend/src/services/docker.ts` — Docker CLI execution

#### Implemented capabilities

| Capability | Status | Implementation |
|------------|--------|----------------|
| Create/Start | ✅ | `startContainer()` with image, command, labels |
| Inspect/Status | ✅ | `getContainerStatus()` returns running/exited/exit_code |
| Log tailing | ✅ | `getContainerLogs()` via `docker logs --tail 100` |
| Artifact mount | ✅ | Mission artifacts dir mounted at `/mission/artifacts` |
| Stop | ✅ | `stopContainer()` |
| Remove | ✅ | `removeContainer()` |
| Cleanup orphans | ✅ | `cleanupOrphanedContainers()` on backend startup |
| Labels | ✅ | `haloop.mission_id`, `haloop.run_id`, `haloop.step_id` |

#### Docker provider details
- Uses `child_process.exec` to shell out to Docker CLI
- Default image: `node:20-slim`
- Proper shell escaping for command arguments
- 1 container per step run (maps to `StepRun.container_id`)
- Network: default bridge with internet access

#### Current mock agent command
For v0, agent steps run:
```bash
sh -c "echo '# Output from [step]' > /mission/artifacts/[output] && \
       cat /mission/artifacts/[input] >> /mission/artifacts/[output]"
```
This allows testing full workflow without real Claude execution.

#### k3s upgrade path (preserved)
The sandbox provider API is intentionally "job-like":
- Docker provider: container = run
- k3s provider: pod/job = run

Backend orchestration (`mission-engine.ts`) calls `sandboxProvider.*` methods only.

---

### Minimal CLI (v0) ❌ NOT STARTED

**Required commands** (not yet implemented):
- `init`: create global home dir + minimal config
- `link`: register a local project path (**only one project at a time**; re-linking replaces previous)
- `start`: start **both** backend + frontend locally
- `status`: show whether backend/frontend are running + linked project

**Current workaround**: Run backend and frontend separately via `pnpm dev` in each package.

**Blocking**: Users cannot run `haloop start` — the primary v0 UX goal.

---

### Testability (v0) ✅ IMPLEMENTED

#### Backend Tests (9 files)
- `mission-store.test.ts` — File persistence
- `mission-engine.test.ts` — Workflow orchestration
- `docker.test.ts` — Container execution
- `workflow.test.ts` — Workflow definition
- `config.test.ts` — Configuration
- `id.test.ts` — ID generation
- `response.test.ts` — API response wrapper
- `routes/missions.test.ts` — API integration tests
- `integration/docker/frontend-runtime.test.ts` — Docker container runtime verification (gated on Docker availability)

#### Frontend E2E Tests (Playwright)
- `tests/e2e/home.test.ts` — Home page E2E test
- `tests/globalSetup.ts` — E2E global setup (starts backend + frontend)
- `tests/globalTeardown.ts` — E2E cleanup
- Config: `playwright.config.ts` with multi-browser support

Tests use mocks/fakes for Docker provider to avoid requiring Docker daemon in CI.

---

### Global Home Directory (Naming Decision)
We keep a global folder in your home directory:
- default: `~/.haloop` (pick one name and stick to it for v0)

This folder conceptually holds:
- missions + artifacts + runs + logs
- linked projects registry (format TBD)
- runtime files (pids, logs)
- any global config (ports, provider selection, etc.)

---

### Sprint Goal Status

| Goal | Status | Notes |
|------|--------|-------|
| Run `haloop start` | ❌ | CLI not implemented |
| UI loads against real backend | ✅ | Works with `VITE_USE_MOCKS=false` |
| Create mission from raw text | ✅ | POST /api/missions works |
| Agent step runs in Docker sandbox | ✅ | Mock agent, but Docker execution works |
| Logs visible in UI (`current_log_tail`) | ✅ | Polling + log tailing implemented |
| Artifacts editable and persisted | ✅ | PUT endpoint + file I/O works |
| Continue through whole workflow | ✅ | 8-step workflow completes end-to-end |

**Summary**: 6/7 goals achieved. Only blocker is CLI (`haloop start`).

**Bonus progress**: E2E testing infrastructure set up with Playwright. GitHub Actions workflow for E2E in progress (`.github/workflows/e2e.yml`).

---

### What Must Happen Next

#### Remaining v0 work
1. **CLI implementation** (packages/cli) — HIGH PRIORITY
   - `init`, `link`, `start`, `status` commands
   - This is the primary blocker for v0 "ship it"

2. **Finalize E2E testing** (in progress)
   - Complete GitHub Actions workflow (`.github/workflows/e2e.yml`)
   - Add more E2E test coverage beyond `home.test.ts`
   - Verify CI pipeline works end-to-end

3. **Real agent execution** (optional for v0)
   - Replace mock command with actual Claude CLI invocation
   - Would need Docker image with Claude Code binary
   - Agent resource resolution from `.claude/` folder

#### Post-v0 (future work)
- Multi-workflow support (load from disk instead of hardcoded)
- LangGraph integration (mentioned in CLAUDE.md but not implemented)
- Project linking UI
- k3s provider

---

### Decisions Made (Resolved Questions)

| Question | Decision | Implementation |
|----------|----------|----------------|
| Mission ID format | UUID with prefix | `m-<uuid>` for missions, `r-<uuid>` for runs |
| Global folder name | `~/.haloop` | Configured via `HALOOP_HOME` env var |
| Workflow storage | Hardcoded for v0 | `packages/backend/src/services/workflow.ts` |
| k3s compatibility | Preserved | Sandbox provider abstraction in place |

---

### Key File Locations

| Component | Path | Purpose |
|-----------|------|---------|
| Backend entry | `packages/backend/src/index.ts` | Express server startup |
| Mission API | `packages/backend/src/routes/missions.ts` | All 6 REST endpoints |
| Mission store | `packages/backend/src/services/mission-store.ts` | File I/O & persistence |
| Mission engine | `packages/backend/src/services/mission-engine.ts` | Workflow orchestration |
| Docker provider | `packages/backend/src/services/docker.ts` | Container execution |
| Sandbox provider | `packages/backend/src/services/sandbox.ts` | High-level abstraction |
| Workflow def | `packages/backend/src/services/workflow.ts` | 8-step pipeline |
| Config | `packages/backend/src/utils/config.ts` | Paths & ports |
| Shared types | `packages/shared/src/types.ts` | All TypeScript types |
| Frontend app | `packages/frontend/src/App.tsx` | Main React component |
| Mission detail | `packages/frontend/src/components/MissionDetail.tsx` | Mission UI |
| API client | `packages/frontend/src/api/client.ts` | Axios HTTP client |
| Playwright config | `packages/frontend/playwright.config.ts` | E2E test configuration |
| E2E tests | `packages/frontend/tests/e2e/` | Playwright E2E tests |