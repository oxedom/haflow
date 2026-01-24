# haflow Backend Vitest Test Plan

## Overview

Test plan for the haflow v0 backend using Vitest. Tests are organized by layer following the implementation structure.

## Test Structure

```
packages/backend/
├── src/
│   ├── services/
│   ├── routes/
│   └── utils/
└── tests/
    ├── unit/
    │   ├── services/
    │   │   ├── mission-store.test.ts
    │   │   ├── workflow.test.ts
    │   │   ├── docker.test.ts
    │   │   └── mission-engine.test.ts
    │   └── utils/
    │       ├── response.test.ts
    │       ├── config.test.ts
    │       └── id.test.ts
    ├── integration/
    │   └── routes/
    │       └── missions.test.ts
    └── setup.ts
```

---

## Unit Tests

### 1. `tests/unit/utils/id.test.ts`

**Module**: `src/utils/id.ts`

| Test Case | Description |
|-----------|-------------|
| `generateMissionId returns prefixed ID` | Should return string starting with `m-` |
| `generateMissionId returns 10-char ID` | Format: `m-` + 8 hex chars |
| `generateMissionId returns unique IDs` | Multiple calls produce different values |
| `generateRunId returns prefixed ID` | Should return string starting with `r-` |
| `generateRunId returns 10-char ID` | Format: `r-` + 8 hex chars |

---

### 2. `tests/unit/utils/response.test.ts`

**Module**: `src/utils/response.ts`

| Test Case | Description |
|-----------|-------------|
| `sendSuccess sets correct status code` | Default 200, respects override |
| `sendSuccess returns ApiResponse shape` | `{ success: true, data: T, error: null }` |
| `sendError sets correct status code` | Default 400, respects override |
| `sendError returns ApiResponse shape` | `{ success: false, data: null, error: string }` |

**Mock**: Express `Response` object with `status()` and `json()` spies

---

### 3. `tests/unit/utils/config.test.ts`

**Module**: `src/utils/config.ts`

| Test Case | Description |
|-----------|-------------|
| `config.port defaults to 4000` | When PORT env not set |
| `config.port respects PORT env` | Parses PORT as integer |
| `config.haflowHome defaults to ~/.haflow` | Uses homedir() |
| `config.haflowHome respects haflow_HOME env` | Uses env value |
| `config.missionsDir is haflowHome/missions` | Computed getter |

**Setup**: Save/restore env vars in beforeEach/afterEach

---

### 4. `tests/unit/services/workflow.test.ts`

**Module**: `src/services/workflow.ts`

| Test Case | Description |
|-----------|-------------|
| `getDefaultWorkflowId returns standard-feature` | Hardcoded for v0 |
| `getDefaultWorkflow returns valid Workflow` | Has workflow_id, name, steps |
| `getDefaultWorkflow has 8 steps` | 4 agent + 4 human-gate |
| `workflow steps alternate agent/human-gate` | Steps 0,2,4,6 are agent; 1,3,5,7 are human-gate |
| `getWorkflowStepName returns correct name` | Maps stepIndex to step.name |
| `getWorkflowStepName returns Complete for out-of-bounds` | Beyond step 7 |
| `agent steps have inputArtifact and outputArtifact` | Required for orchestration |
| `human-gate steps have reviewArtifact` | Required for UI |

---

### 5. `tests/unit/services/mission-store.test.ts`

**Module**: `src/services/mission-store.ts`

**Setup**: Use temp directory for `config.missionsDir` via vi.mock

#### Init & Directory Structure

| Test Case | Description |
|-----------|-------------|
| `init creates missions directory if not exists` | Creates `~/.haflow/missions/` |
| `init is idempotent` | Safe to call multiple times |

#### Create Mission

| Test Case | Description |
|-----------|-------------|
| `createMission returns MissionMeta` | With generated ID, timestamps |
| `createMission creates directory structure` | `<id>/`, `artifacts/`, `runs/`, `logs/` |
| `createMission writes mission.json` | Contains serialized MissionMeta |
| `createMission writes raw-input.md artifact` | With provided rawInput content |
| `createMission sets initial status to ready` | Default state |
| `createMission sets current_step to 0` | Starting step |

#### Read Operations

| Test Case | Description |
|-----------|-------------|
| `getMeta returns null for non-existent mission` | Graceful handling |
| `getMeta returns parsed MissionMeta` | From mission.json |
| `getDetail returns null for non-existent mission` | Graceful handling |
| `getDetail includes workflow` | From workflow service |
| `getDetail includes artifacts` | Loaded from disk |
| `getDetail includes runs` | Loaded and sorted by started_at |
| `listMissions returns empty array when no missions` | Initial state |
| `listMissions returns MissionListItem[]` | Subset of MissionMeta fields |
| `listMissions sorts by updated_at desc` | Most recent first |

#### Update Operations

| Test Case | Description |
|-----------|-------------|
| `updateMeta throws for non-existent mission` | Error handling |
| `updateMeta merges partial updates` | Preserves existing fields |
| `updateMeta updates updated_at timestamp` | Automatic touch |

#### Artifacts

| Test Case | Description |
|-----------|-------------|
| `getArtifact returns null for non-existent artifact` | Graceful handling |
| `getArtifact returns file content as string` | UTF-8 decoded |
| `saveArtifact creates file` | In artifacts/ directory |
| `saveArtifact overwrites existing file` | Update scenario |
| `loadArtifacts returns Record<filename, content>` | All artifacts |

#### Runs

| Test Case | Description |
|-----------|-------------|
| `createRun returns StepRun with generated ID` | Format: `r-xxxxxxxx` |
| `createRun sets started_at timestamp` | ISO string |
| `createRun writes run JSON file` | In runs/ directory |
| `loadRuns returns empty array when no runs` | Initial state |
| `loadRuns returns sorted StepRun[]` | By started_at ascending |
| `updateRun merges partial updates` | finished_at, exit_code, container_id |

#### Logs

| Test Case | Description |
|-----------|-------------|
| `appendLog creates log file if not exists` | First append |
| `appendLog appends to existing log` | Subsequent appends |
| `getLogTail returns empty string for non-existent log` | Graceful handling |
| `getLogTail returns last N bytes` | Default 2000 |

---

### 6. `tests/unit/services/docker.test.ts`

**Module**: `src/services/docker.ts`

**Mock**: `child_process.exec` via vi.mock

#### Availability

| Test Case | Description |
|-----------|-------------|
| `isAvailable returns true when docker works` | `docker version` succeeds |
| `isAvailable returns false when docker fails` | Command throws |

#### Start Container

| Test Case | Description |
|-----------|-------------|
| `start constructs correct docker run command` | Verify args |
| `start includes all labels` | mission_id, run_id, step_id |
| `start mounts artifacts volume` | `-v path:/mission/artifacts` |
| `start sets working directory` | `-w /mission` |
| `start uses provided image` | Or default node:20-slim |
| `start shell-escapes sh -c commands` | Prevents injection |
| `start returns container ID from stdout` | Trimmed |

#### Get Status

| Test Case | Description |
|-----------|-------------|
| `getStatus parses running state` | From docker inspect |
| `getStatus parses exited state with exit code` | Includes exitCode |
| `getStatus returns unknown on error` | When inspect fails |
| `getStatus parses timestamps` | startedAt, finishedAt |

#### Logs

| Test Case | Description |
|-----------|-------------|
| `getLogTail returns stdout from docker logs` | Last 100 lines |
| `getLogTail slices to byte limit` | Default 2000 bytes |
| `getLogTail returns empty string on error` | Graceful handling |

#### Cleanup

| Test Case | Description |
|-----------|-------------|
| `stop calls docker stop` | With container ID |
| `stop ignores errors` | Container may already be stopped |
| `remove calls docker rm -f` | Force remove |
| `remove ignores errors` | Container may already be removed |
| `cleanupOrphaned finds containers by label` | Filter by haflow.mission_id |
| `cleanupOrphaned removes found containers` | Calls remove() for each |

---

### 7. `tests/unit/services/mission-engine.test.ts`

**Module**: `src/services/mission-engine.ts`

**Mock**: `dockerProvider`, `missionStore`, `workflow` services

#### Init

| Test Case | Description |
|-----------|-------------|
| `init checks provider availability` | Calls isAvailable() |
| `init logs warning when provider unavailable` | Console.warn |
| `init calls cleanupOrphaned` | Removes stale containers |

#### Continue Mission - Human Gates

| Test Case | Description |
|-----------|-------------|
| `continueMission throws for non-existent mission` | Error handling |
| `continueMission at human-gate advances to next step` | Increments current_step |
| `continueMission at human-gate sets waiting_human for next human-gate` | Status update |
| `continueMission at human-gate sets ready for next agent step` | Status update |
| `continueMission at last step sets completed` | Final state |

#### Continue Mission - Agent Steps

| Test Case | Description |
|-----------|-------------|
| `continueMission at agent step creates run record` | Via missionStore.createRun |
| `continueMission at agent step sets running_code_agent status` | Status update |
| `continueMission at agent step calls provider.start` | With correct options |
| `continueMission at agent step starts monitoring` | Sets interval |
| `continueMission handles provider.start failure` | Sets failed status, records error |

#### Monitor Container

| Test Case | Description |
|-----------|-------------|
| `monitorContainer captures logs periodically` | Via getLogTail |
| `monitorContainer detects exited state` | Clears interval |
| `monitorContainer updates run record on exit` | finished_at, exit_code |
| `monitorContainer cleans up container on exit` | Calls provider.remove |
| `monitorContainer advances on exit code 0` | Success path |
| `monitorContainer sets failed status on non-zero exit` | Failure path |

---

## Integration Tests

### 8. `tests/integration/routes/missions.test.ts`

**Module**: `src/routes/missions.ts`

**Setup**:
- Create Express app with routes
- Use temp directory for missions
- Mock or use real Docker (configurable)

#### GET /api/missions

| Test Case | Description |
|-----------|-------------|
| `returns empty array when no missions` | Initial state |
| `returns array of MissionListItem` | After creating missions |
| `missions sorted by updated_at desc` | Most recent first |

#### GET /api/missions/:missionId

| Test Case | Description |
|-----------|-------------|
| `returns 404 for non-existent mission` | Error response |
| `returns MissionDetail for valid ID` | Full detail |
| `includes workflow in response` | Embedded workflow |
| `includes artifacts in response` | Loaded from disk |

#### POST /api/missions

| Test Case | Description |
|-----------|-------------|
| `returns 400 for missing title` | Validation |
| `returns 400 for missing type` | Validation |
| `returns 400 for missing rawInput` | Validation |
| `returns 201 with MissionMeta` | Success response |
| `creates mission on disk` | Directory structure |

#### PUT /api/missions/:missionId/artifacts/:filename

| Test Case | Description |
|-----------|-------------|
| `returns 404 for non-existent mission` | Error response |
| `saves artifact content` | Written to disk |
| `updates mission updated_at` | Touch timestamp |

#### POST /api/missions/:missionId/continue

| Test Case | Description |
|-----------|-------------|
| `returns 404 for non-existent mission` | Error response |
| `returns 200 on success` | Async operation started |
| `advances mission state` | Via mission engine |

#### POST /api/missions/:missionId/mark-completed

| Test Case | Description |
|-----------|-------------|
| `returns 404 for non-existent mission` | Error response |
| `sets status to completed` | Force complete |

---

## Test Setup

### `tests/setup.ts`

```typescript
import { vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'haflow-test-'));
  vi.stubEnv('haflow_HOME', testDir);
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

export { testDir };
```

### `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
    },
  },
});
```

---

## Implementation Priority

1. **Phase 1: Utils** - Quick wins, no mocking needed
   - `id.test.ts`
   - `response.test.ts`
   - `config.test.ts`

2. **Phase 2: Workflow** - Static data, no side effects
   - `workflow.test.ts`

3. **Phase 3: Mission Store** - Core persistence layer
   - `mission-store.test.ts` (file system mocking via temp dirs)

4. **Phase 4: Docker Provider** - External dependency
   - `docker.test.ts` (requires exec mocking)

5. **Phase 5: Mission Engine** - Orchestration logic
   - `mission-engine.test.ts` (requires service mocking)

6. **Phase 6: API Routes** - Integration
   - `missions.test.ts` (supertest with real/mock services)

---

## Running Tests

```bash
# Run all tests
pnpm --filter @haflow/backend test

# Run with coverage
pnpm --filter @haflow/backend test:coverage

# Run specific test file
pnpm --filter @haflow/backend test mission-store

# Run in watch mode
pnpm --filter @haflow/backend test:watch
```
