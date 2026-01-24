---
date: 2026-01-24T12:00:00+00:00
researcher: Claude
git_commit: 98ca88ecf40e1df89111328e4fae42e33f5e0ea0
branch: main
repository: haflow
topic: "E2E Test Planning - Full Application Research"
tags: [research, e2e, testing, playwright, architecture, missions, workflow]
status: complete
last_updated: 2026-01-24
last_updated_by: Claude
---

# Research: E2E Test Planning - Full Application Research

**Date**: 2026-01-24T12:00:00+00:00
**Researcher**: Claude
**Git Commit**: 98ca88ecf40e1df89111328e4fae42e33f5e0ea0
**Branch**: main
**Repository**: haflow

## Research Question

Plan E2E tests for the whole app, research how the app works, and create a pre-implementation research plan.

## Summary

Haflow is a **local-first orchestrator** for AI-assisted "missions" with an 8-step workflow alternating between agent execution (Docker containers) and human review gates. The application consists of:

- **Frontend**: React 19 + Vite + TailwindCSS with TanStack Query for polling
- **Backend**: Express.js API with file-based persistence (`~/.haflow/missions/`)
- **Shared**: Zod schemas for runtime validation and TypeScript type inference

**Current E2E Coverage**: 2 test files with ~20 test cases covering home page and voice transcription. **Major gaps** exist in mission lifecycle, workflow progression, artifact editing, and Docker agent execution testing.

## Detailed Findings

### 1. Application Architecture

#### Frontend (`packages/frontend/`)

**Entry Point**: `src/main.tsx` → `src/App.tsx`

**Key Components**:
| Component | File | Purpose |
|-----------|------|---------|
| App | `src/App.tsx:21-223` | Root component with state management |
| Sidebar | `src/components/Sidebar.tsx` | Mission list and navigation |
| MissionDetail | `src/components/MissionDetail.tsx` | Workflow display and artifact editing |
| NewMissionModal | `src/components/NewMissionModal.tsx` | Mission creation form |
| ChatVoice | `src/components/ChatVoice.tsx` | Voice-enabled chat interface |
| VoiceRecorderButton | `src/components/VoiceRecorderButton.tsx` | Audio recording with visual feedback |

**State Management**:
- TanStack Query with 2s polling for missions list
- Adaptive polling (500ms) when mission is `running_code_agent` or `running_root_llm`
- Local state for UI (modals, sidebar, voice chat)
- No routing library - conditional rendering based on `selectedMissionId`

**API Client** (`src/api/client.ts`):
- Base URL: `http://localhost:4000/api`
- Methods: `listMissions`, `getMission`, `createMission`, `saveArtifact`, `continueMission`, `markCompleted`, `transcribeAudio`, `getTranscriptionStatus`

#### Backend (`packages/backend/`)

**Entry Point**: `src/index.ts` → `src/server.ts`

**API Endpoints** (`src/routes/missions.ts`):
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/missions` | List all missions |
| GET | `/api/missions/:id` | Get mission detail |
| POST | `/api/missions` | Create new mission |
| PUT | `/api/missions/:id/artifacts/:filename` | Save artifact |
| POST | `/api/missions/:id/continue` | Advance workflow |
| POST | `/api/missions/:id/mark-completed` | Force complete |

**Transcription Endpoints** (`src/routes/transcription.ts`):
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/transcribe` | Transcribe audio file |
| GET | `/api/transcribe/status` | Check if transcription available |

**Core Services**:
- `mission-store.ts` - File-based persistence at `~/.haflow/missions/`
- `mission-engine.ts` - Workflow orchestration with 1s container polling
- `docker.ts` - Docker CLI wrapper with label-based container tracking
- `workflow.ts` - Hardcoded 8-step "standard-feature" workflow

#### Shared (`packages/shared/`)

**Schemas** (`src/schemas.ts`):
- `MissionTypeSchema`: `'feature' | 'fix' | 'bugfix' | 'hotfix' | 'enhance'`
- `MissionStatusSchema`: 7 states including `draft`, `ready`, `waiting_human`, `running_code_agent`, `failed`, `completed`
- `WorkflowStepSchema`: Defines agent/human-gate steps with input/output artifacts
- `MissionMetaSchema`, `MissionDetailSchema`, `StepRunSchema`
- Request validation: `CreateMissionRequestSchema`, `SaveArtifactRequestSchema`

### 2. Mission Workflow Lifecycle

#### The 8-Step Pipeline (`workflow.ts:4-19`)

| Step | Type | Input | Output |
|------|------|-------|--------|
| 0. Cleanup | agent | raw-input.md // INPUT via memoery in browser | structured-text.md |
| 1. Review Structured | human-gate | - | (reviews structured-text.md) |
| 2. Research | agent | structured-text.md | research-output.md |
| 3. Review Research | human-gate | - | (reviews research-output.md) |
| 4. Planning | agent | research-output.md | implementation-plan.md |
| 5. Review Plan | human-gate | - | (reviews implementation-plan.md) |
| 6. Implementation | agent | implementation-plan.md | implementation-result.json |
| 7. Review Implementation | human-gate | - | (reviews implementation-result.json) |

#### State Transitions

```
┌─────────┐  create   ┌───────┐  continue  ┌──────────────────────┐
│  draft  │ ────────► │ ready │ ─────────► │ running_code_agent   │
└─────────┘           └───────┘            └──────────────────────┘
                                                     │
                          ┌──────────────────────────┼──────────────────────┐
                          ▼                          ▼                      ▼
                   ┌──────────────┐          ┌───────────┐          ┌───────────┐
                   │waiting_human │          │  failed   │          │ completed │
                   └──────────────┘          └───────────┘          └───────────┘
                          │
                          │ continue (advances to next agent step)
                          ▼
                   ┌───────────────────────┐
                   │ running_code_agent    │
                   └───────────────────────┘
```

#### Key Orchestration Logic (`mission-engine.ts`)

1. **`continueMission(missionId)`** (line 24-44): Entry point for workflow advancement
2. **`startAgentStep()`** (line 76-112): Launches Docker container or Claude streaming
3. **`monitorContainer()`** (line 258-302): 1s polling loop for container status
4. **`advanceToNextStep()`** (line 46-74): Transitions to next step after completion

### 3. Docker/Sandbox Execution

#### Container Management (`docker.ts`)

**Labels**: All containers tagged with:
- `haflow.mission_id`
- `haflow.run_id`
- `haflow.step_id`

**Execution Modes**:
1. **Claude Streaming** (`startClaudeStreaming`, line 257-414): Uses `claude` CLI with `--output-format stream-json`
2. **Mock Agent** (`start`, line 28-91): Uses `node:20-slim` for testing

**Volume Mounts**:
- `~/.haflow/missions/{id}/artifacts` → `/mission/artifacts` (read-write)
- `~/.claude/.credentials.json` → `/home/agent/.claude/.credentials.json` (read-only)
- `~/.gitconfig` → `/home/agent/.gitconfig` (read-only, conditional)

**Completion Detection**: Looks for `<promise>COMPLETE</promise>` marker in output

#### Orphan Cleanup

Both backend and frontend E2E tests clean up containers in teardown:
```typescript
docker ps -aq --filter="label=haflow.mission_id"
docker rm -f {ids}
```

### 4. Existing Test Infrastructure

#### Backend Tests (Vitest)

**Configuration**: `packages/backend/vitest.config.ts`
- 30s timeout for Docker operations
- Global setup starts Express on port 4001
- Per-test isolation via temp `HAFLOW_HOME` directory

**Test Files** (12 files, 269+ test cases):
| Category | Files | Coverage |
|----------|-------|----------|
| Unit - Services | 5 | mission-store, mission-engine, docker, workflow, transcription |
| Unit - Utils | 3 | id, response, config |
| Integration - Routes | 1 | All 6 mission endpoints |
| Integration - Docker | 2 | frontend-runtime, postgres |


#### Frontend E2E Tests (Playwright)

**Configuration**: `packages/frontend/playwright.config.ts`
- Browsers: Chromium, Firefox, WebKit
- Auto-starts backend (port 4000) and frontend (port 5173)
- Test directory: `tests/e2e/`
- Global setup creates isolated `HAFLOW_HOME` at `/tmp/haflow-e2e`

**Existing Test Files** (2 files, ~20 test cases):

1. **`home.test.ts`** (76 lines):
   - Page loading, welcome message
   - Navigation elements
   - New mission modal open/close
   - API health checks

2. **`voice-transcription.test.ts`** (266 lines):
   - ChatVoice component interactions
   - Voice recorder button states
   - Transcription API status
   - Microphone permission flow (Chromium only)

### 5. E2E Test Gap Analysis

#### Currently Covered
- Home page load and basic navigation
- New mission modal UI
- Voice transcription feature
- API health endpoints

#### Major Gaps (Not Covered)

| Area | What's Missing |
|------|----------------|
| **Mission Creation** | Full flow: form fill → submit → mission appears in sidebar |
| **Mission Selection** | Click sidebar item → detail view loads |
| **Artifact Display** | Correct artifact shown for current step |
| **Artifact Editing** | Edit textarea → save draft → content persists |
| **Workflow Progression** | Human approval → status changes → agent starts |
| **Agent Execution** | Status shows "running", logs appear, completes |
| **Error Handling** | Failed agent → mission shows failed state |
| **Mark Completed** | Force complete bypasses remaining steps |
| **Multi-Mission** | Multiple missions in sidebar, switching between |
| **Real-time Updates** | Polling updates UI when status changes |

## E2E Test Plan

### Phase 1: Core Mission Lifecycle

#### Test Suite: Mission Creation
```typescript
test.describe('Mission Creation', () => {
  test('should create mission with all fields')
  test('should show validation errors for empty fields')
  test('should appear in sidebar after creation')
  test('should be selected after creation')
  test('should have initial status "ready"')
});
```

#### Test Suite: Mission Selection and Display
```typescript
test.describe('Mission Selection', () => {
  test('should load mission detail when clicked in sidebar')
  test('should display correct status badge')
  test('should show workflow timeline with current step highlighted')
  test('should display correct artifact for current step')
});
```

### Phase 2: Workflow Progression

#### Test Suite: Human Gates
```typescript
test.describe('Human Review Gates', () => {
  test('should show editor with review artifact content')
  test('should enable save draft when content modified')
  test('should persist changes after save draft')
  test('should switch between editor/diff/preview modes')
  test('should advance to next step on continue click')
});
```

#### Test Suite: Agent Execution (Mocked)
```typescript
test.describe('Agent Execution', () => {
  test('should show "running" status during execution')
  test('should display live log tail')
  test('should transition to waiting_human after completion')
  test('should show new artifact after agent completes')
});
```

### Phase 3: Error and Edge Cases

#### Test Suite: Error Handling
```typescript
test.describe('Error Handling', () => {
  test('should show failed status when agent fails')
  test('should display error message')
  test('should allow mark-completed from failed state')
});
```

#### Test Suite: Multi-Mission
```typescript
test.describe('Multiple Missions', () => {
  test('should display multiple missions in sidebar')
  test('should sort by updated_at descending')
  test('should switch between missions correctly')
  test('should maintain mission state when switching')
});
```

### Phase 4: Voice and Transcription

#### Test Suite: Voice Input
```typescript
test.describe('Voice Input in Mission Creation', () => {
  test('should append transcription to raw input')
  test('should show recording state')
  test('should handle transcription errors gracefully')
});
```

## Implementation Considerations

### Test Data Management

1. **Isolation**: Each test run uses unique `HAFLOW_HOME` in `/tmp/haflow-e2e/`
2. **Cleanup**: Docker containers removed in globalTeardown
3. **Fixtures**: Consider creating mission fixtures for multi-step tests

### Mocking Strategy

1. **Docker/Claude**: Mock for CI, real for local integration tests
2. **Transcription**: Mock OpenAI Whisper API responses
3. **Time**: Consider mocking for timestamp-dependent tests

### Test IDs Needed

Add `data-testid` attributes to these elements:
- Mission sidebar items: `mission-item-{id}`
- Mission status badges: `status-badge-{status}`
- Workflow step indicators: `workflow-step-{index}`
- Artifact editor: `artifact-editor`
- Save draft button: `save-draft-btn`
- Continue button: `continue-btn`
- Log viewer: `log-viewer`

### CI Configuration

Current `.github/workflows/e2e.yml` runs Chromium only. Consider:
- Keeping single browser for CI speed
- Running Firefox/WebKit on release branches
- Adding artifact uploads for failure debugging

## Code References

### Frontend Key Files
- `packages/frontend/src/App.tsx:21-223` - Main application logic
- `packages/frontend/src/components/MissionDetail.tsx:189-375` - Mission display and editing
- `packages/frontend/src/api/client.ts:14-71` - API client methods
- `packages/frontend/tests/e2e/home.test.ts` - Existing E2E tests

### Backend Key Files
- `packages/backend/src/routes/missions.ts:10-106` - All mission endpoints
- `packages/backend/src/services/mission-engine.ts:24-302` - Workflow orchestration
- `packages/backend/src/services/mission-store.ts:23-226` - File persistence
- `packages/backend/src/services/docker.ts:28-414` - Container management

### Test Infrastructure
- `packages/frontend/playwright.config.ts:1-55` - Playwright configuration
- `packages/frontend/tests/globalSetup.ts:1-15` - Test environment setup
- `packages/frontend/tests/e2e-env.ts:1-24` - Environment variables

## Architecture Insights

1. **Polling-Based Real-Time**: No WebSockets; uses TanStack Query refetchInterval for updates
2. **File-Based Persistence**: No database; missions stored as JSON/files at `~/.haflow`
3. **Container Labels**: All Docker containers labeled for tracking and cleanup
4. **Completion Marker**: Agents signal completion via `<promise>COMPLETE</promise>` in output
5. **Automatic Chaining**: After human approval, next agent step starts automatically

## FACTS 

1. **THIS WILL NOT RUN IN CI**


## Recommended Next Steps

1. **Add test IDs** to frontend components for reliable E2E selection
2. **Implement Phase 1 tests** for core mission creation and selection
3. **Create mock agent** configuration for CI without real Docker/Claude
4. **Add E2E fixtures** for pre-seeded mission states (waiting_human, running, failed)
5. **Document test patterns** in contributing guide
