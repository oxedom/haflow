
# haflow v0 Backend Implementation Plan

## Overview

Implement the backend for haflow v0 - a local-first orchestrator that runs AI-assisted "missions" against real projects, with human gates and ephemeral Docker sandboxes. The backend provides a REST API consumed by the existing React frontend via polling.

## Current State Analysis

### What Exists:
- `packages/backend/package.json` - Has dependencies (Express, Zod, uuid) but **no src/ code**
- `packages/shared/src/types.ts` - Complete type definitions for API contract
- `packages/frontend/src/api/client.ts` - Frontend expects API at `localhost:4000/api`
- `packages/frontend/src/mocks/data.ts` - Mock data showing exact workflow structure (8 steps)

### What's Missing:
- All backend source code (src/ directory)
- API endpoints implementation
- Mission disk storage layer
- Sandbox provider abstraction
- Docker provider implementation
- Mission orchestration engine

## Desired End State

A functional backend that:
1. Serves all 6 API endpoints expected by the frontend
2. Persists missions/artifacts/runs to `~/.haflow/missions/`
3. Executes agent steps in Docker containers via a provider abstraction
4. Returns `current_log_tail` for running containers
5. Supports the full v0 workflow (4 agent steps + 4 human gates)

### Verification:
- Frontend runs with `VITE_USE_MOCKS=false` against real backend
- Create mission → agent runs in Docker → approve gates → complete workflow

## What We're NOT Doing

- **No streaming/SSE/WebSocket** - polling only (refetchInterval: 2000ms)
- **No authentication** - local-only for v0
- **No k3s provider** - Docker only, but behind abstraction
- **No project linking** - missions exist globally under ~/.haflow
- **No workflow templates system** - hardcoded workflow for v0
- **No database** - files on disk only

## Implementation Approach

Layer the implementation bottom-up, using function-based services (no classes):
1. Core server setup and utilities
2. Mission store service (disk persistence)
3. API routes (matching frontend contract exactly)
4. Sandbox provider service interface
5. Docker provider service implementation
6. Mission engine service (orchestration logic)

---

## Phase 1: Core Server Setup

### Overview
Set up the Express server skeleton with middleware, error handling, and API response wrapper.

### Changes Required:

#### 0. Shared mission type
**File**: `packages/shared/src/types.ts`
- Add a `MissionType` union for branch-friendly types:
  - `feature` | `fix` | `bugfix` | `hotfix` | `enhance`
- Use `MissionType` for `CreateMissionRequest.type` and `MissionMeta.type`

#### 1. Create src directory structure
```
packages/backend/src/
├── index.ts           # Entry point, server startup
├── server.ts          # Express app configuration
├── routes/
│   └── missions.ts    # Mission API routes
├── services/
│   ├── mission-store.ts    # Disk persistence service
│   ├── workflow.ts         # Workflow lookup service
│   ├── sandbox.ts          # Abstract provider interface
│   ├── docker.ts           # Docker provider service
│   └── mission-engine.ts   # Orchestration service
└── utils/
    ├── response.ts         # ApiResponse wrapper
    ├── config.ts           # Configuration (paths, ports)
    └── id.ts               # ULID generation
```

#### 2. Entry point and server
**File**: `packages/backend/src/index.ts`
```typescript
import { createServer } from './server.js';
import { config } from './utils/config.js';

const app = createServer();

app.listen(config.port, () => {
  console.log(`haflow backend listening on port ${config.port}`);
});
```

**File**: `packages/backend/src/server.ts`
```typescript
import express from 'express';
import cors from 'cors';
import { missionRoutes } from './routes/missions.js';

export function createServer() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use('/api/missions', missionRoutes);

  // Error handler
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({
      success: false,
      data: null,
      error: err.message,
    });
  });

  return app;
}
```

#### 3. Configuration
**File**: `packages/backend/src/utils/config.ts`
```typescript
import { homedir } from 'os';
import { join } from 'path';

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  haflowHome: process.env.haflow_HOME || join(homedir(), '.haflow'),
  get missionsDir() {
    return join(this.haflowHome, 'missions');
  },
  // Workflows live with the backend for v0
  get workflowsDir() {
    return join(process.cwd(), 'packages/backend/public/workflows');
  },
};
```

#### 4. Response wrapper utility
**File**: `packages/backend/src/utils/response.ts`
```typescript
import type { ApiResponse } from '@haflow/shared';
import type { Response } from 'express';

export function sendSuccess<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({
    success: true,
    data,
    error: null,
  } satisfies ApiResponse<T>);
}

export function sendError(res: Response, error: string, status = 400): void {
  res.status(status).json({
    success: false,
    data: null,
    error,
  } satisfies ApiResponse<null>);
}
```

#### 5. ID generation
**File**: `packages/backend/src/utils/id.ts`
```typescript
import { v4 as uuidv4 } from 'uuid';

// Using UUID for v0; can switch to ULID later if sortability needed
export function generateMissionId(): string {
  return `m-${uuidv4().slice(0, 8)}`;
}

export function generateRunId(): string {
  return `r-${uuidv4().slice(0, 8)}`;
}
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @haflow/backend build` compiles without errors
- [x] `curl localhost:4000/api/missions` returns valid JSON (empty array or error)
- [x] Server starts: `pnpm --filter @haflow/backend dev`

#### Manual Verification:
- [ ] No TypeScript errors in IDE

---

## Phase 2: Mission Store (Disk Persistence)

### Overview
Implement the disk-based storage layer for missions, artifacts, runs, and logs.

### Changes Required:

#### 1. Mission Store Service
**File**: `packages/backend/src/services/mission-store.ts`
```typescript
import { mkdir, readdir, readFile, writeFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { MissionMeta, MissionDetail, MissionListItem, StepRun, MissionType } from '@haflow/shared';
import { config } from '../utils/config.js';
import { generateMissionId, generateRunId } from '../utils/id.js';
import { getDefaultWorkflow, getDefaultWorkflowId, getWorkflowStepName } from './workflow.js';

const missionsDir = () => config.missionsDir;
const missionDir = (missionId: string) => join(missionsDir(), missionId);
const artifactsDir = (missionId: string) => join(missionDir(missionId), 'artifacts');
const runsDir = (missionId: string) => join(missionDir(missionId), 'runs');
const logsDir = (missionId: string) => join(missionDir(missionId), 'logs');
const metaPath = (missionId: string) => join(missionDir(missionId), 'mission.json');

async function init(): Promise<void> {
  if (!existsSync(missionsDir())) {
    await mkdir(missionsDir(), { recursive: true });
  }
}

// --- Create ---
async function createMission(
  title: string,
  type: MissionType,
  rawInput: string
): Promise<MissionMeta> {
  const missionId = generateMissionId();
  const now = new Date().toISOString();

  const meta: MissionMeta = {
    mission_id: missionId,
    title,
    type,
    workflow_id: getDefaultWorkflowId(),
    current_step: 0,
    status: 'ready',
    created_at: now,
    updated_at: now,
    errors: [],
  };

  // Create directories
  await mkdir(missionDir(missionId), { recursive: true });
  await mkdir(artifactsDir(missionId), { recursive: true });
  await mkdir(runsDir(missionId), { recursive: true });
  await mkdir(logsDir(missionId), { recursive: true });

  // Write mission.json
  await writeFile(metaPath(missionId), JSON.stringify(meta, null, 2));

  // Write raw-input.md artifact
  await saveArtifact(missionId, 'raw-input.md', rawInput);

  return meta;
}

// --- Read ---
async function getMeta(missionId: string): Promise<MissionMeta | null> {
  const path = metaPath(missionId);
  if (!existsSync(path)) return null;
  const content = await readFile(path, 'utf-8');
  return JSON.parse(content);
}

async function getDetail(missionId: string): Promise<MissionDetail | null> {
  const meta = await getMeta(missionId);
  if (!meta) return null;

  const workflow = getDefaultWorkflow();
  const artifacts = await loadArtifacts(missionId);
  const runs = await loadRuns(missionId);
  const currentLogTail = await getCurrentLogTail(missionId, runs);

  return {
    ...meta,
    workflow,
    artifacts,
    runs,
    current_log_tail: currentLogTail,
  };
}

async function listMissions(): Promise<MissionListItem[]> {
  await init();
  const entries = await readdir(missionsDir(), { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);

  const items: MissionListItem[] = [];

  for (const missionId of dirs) {
    const meta = await getMeta(missionId);
    if (meta) {
      items.push({
        mission_id: meta.mission_id,
        title: meta.title,
        type: meta.type,
        status: meta.status,
        current_step_name: getWorkflowStepName(meta.workflow_id, meta.current_step),
        updated_at: meta.updated_at,
      });
    }
  }

  // Sort by updated_at desc
  items.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  return items;
}

// --- Update ---
async function updateMeta(missionId: string, updates: Partial<MissionMeta>): Promise<void> {
  const meta = await getMeta(missionId);
  if (!meta) throw new Error(`Mission not found: ${missionId}`);

  const updated = {
    ...meta,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  await writeFile(metaPath(missionId), JSON.stringify(updated, null, 2));
}

// --- Artifacts ---
async function loadArtifacts(missionId: string): Promise<Record<string, string>> {
  const dir = artifactsDir(missionId);
  if (!existsSync(dir)) return {};

  const files = await readdir(dir);
  const artifacts: Record<string, string> = {};

  for (const file of files) {
    const content = await readFile(join(dir, file), 'utf-8');
    artifacts[file] = content;
  }

  return artifacts;
}

async function getArtifact(missionId: string, filename: string): Promise<string | null> {
  const path = join(artifactsDir(missionId), filename);
  if (!existsSync(path)) return null;
  return readFile(path, 'utf-8');
}

async function saveArtifact(missionId: string, filename: string, content: string): Promise<void> {
  const dir = artifactsDir(missionId);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(join(dir, filename), content);
}

// --- Runs ---
async function loadRuns(missionId: string): Promise<StepRun[]> {
  const dir = runsDir(missionId);
  if (!existsSync(dir)) return [];

  const files = await readdir(dir);
  const runs: StepRun[] = [];

  for (const file of files) {
    if (file.endsWith('.json')) {
      const content = await readFile(join(dir, file), 'utf-8');
      runs.push(JSON.parse(content));
    }
  }

  // Sort by started_at
  runs.sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
  return runs;
}

async function createRun(missionId: string, stepId: string): Promise<StepRun> {
  const runId = generateRunId();
  const run: StepRun = {
    step_id: stepId,
    run_id: runId,
    started_at: new Date().toISOString(),
  };

  const dir = runsDir(missionId);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(join(dir, `${runId}.json`), JSON.stringify(run, null, 2));

  return run;
}

async function updateRun(missionId: string, runId: string, updates: Partial<StepRun>): Promise<void> {
  const path = join(runsDir(missionId), `${runId}.json`);
  const content = await readFile(path, 'utf-8');
  const run = JSON.parse(content);
  const updated = { ...run, ...updates };
  await writeFile(path, JSON.stringify(updated, null, 2));
}

// --- Logs ---
async function appendLog(missionId: string, runId: string, data: string): Promise<void> {
  const dir = logsDir(missionId);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  const path = join(dir, `${runId}.log`);

  // Append mode
  const existing = existsSync(path) ? await readFile(path, 'utf-8') : '';
  await writeFile(path, existing + data);
}

async function getLogTail(missionId: string, runId: string, bytes = 2000): Promise<string> {
  const path = join(logsDir(missionId), `${runId}.log`);
  if (!existsSync(path)) return '';

  const content = await readFile(path, 'utf-8');
  return content.slice(-bytes);
}

async function getCurrentLogTail(missionId: string, runs: StepRun[]): Promise<string | undefined> {
  // Find the most recent run without finished_at (still running)
  const runningRun = runs.find(r => !r.finished_at);
  if (!runningRun) return undefined;

  return getLogTail(missionId, runningRun.run_id);
}

export const missionStore = {
  init,
  createMission,
  getMeta,
  getDetail,
  listMissions,
  updateMeta,
  loadArtifacts,
  getArtifact,
  saveArtifact,
  loadRuns,
  createRun,
  updateRun,
  appendLog,
  getLogTail,
};
```

#### 2. Workflow Service (hardcoded map for v0)
**File**: `packages/backend/src/services/workflow.ts`
- Workflow definitions live in `packages/backend/public/workflows/` for v0;
  the service can later read JSON from there, but starts with an in-memory map.
```typescript
import type { Workflow } from '@haflow/shared';

// Hardcoded for v0 - matches frontend mock exactly
const WORKFLOWS: Record<string, Workflow> = {
  'standard-feature': {
    workflow_id: 'standard-feature',
    name: 'Standard Feature',
    steps: [
      { step_id: 'cleanup', name: 'Cleanup', type: 'agent', agent: 'cleanup-agent', inputArtifact: 'raw-input.md', outputArtifact: 'structured-text.md' },
      { step_id: 'review-structured', name: 'Review Structured', type: 'human-gate', reviewArtifact: 'structured-text.md' },
      { step_id: 'research', name: 'Research', type: 'agent', agent: 'research-agent', inputArtifact: 'structured-text.md', outputArtifact: 'research-output.md' },
      { step_id: 'review-research', name: 'Review Research', type: 'human-gate', reviewArtifact: 'research-output.md' },
      { step_id: 'planning', name: 'Planning', type: 'agent', agent: 'planning-agent', inputArtifact: 'research-output.md', outputArtifact: 'implementation-plan.md' },
      { step_id: 'review-plan', name: 'Review Plan', type: 'human-gate', reviewArtifact: 'implementation-plan.md' },
      { step_id: 'implementation', name: 'Implementation', type: 'agent', agent: 'impl-agent', inputArtifact: 'implementation-plan.md', outputArtifact: 'implementation-result.json' },
      { step_id: 'review-impl', name: 'Review Implementation', type: 'human-gate', reviewArtifact: 'implementation-result.json' },
    ],
  },
};

export function getDefaultWorkflowId(): string {
  return 'standard-feature';
}

export function getDefaultWorkflow(): Workflow {
  return WORKFLOWS[getDefaultWorkflowId()];
}

export function getWorkflowStepName(workflowId: string, stepIndex: number): string {
  const workflow = WORKFLOWS[workflowId] || getDefaultWorkflow();
  return workflow.steps[stepIndex]?.name || 'Complete';
}
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @haflow/backend build` compiles without errors
- [x] After creating a mission via API, `~/.haflow/missions/<id>/` exists with correct structure
- [x] `mission.json`, `artifacts/raw-input.md` are created correctly

#### Manual Verification:
- [ ] `ls ~/.haflow/missions/` shows mission folders
- [ ] `cat ~/.haflow/missions/<id>/mission.json` shows valid JSON

---

## Phase 3: API Routes

### Overview
Implement all 6 API endpoints matching the frontend contract exactly.

### Changes Required:

#### 1. Mission Routes
**File**: `packages/backend/src/routes/missions.ts`
```typescript
import { Router } from 'express';
import type { CreateMissionRequest, SaveArtifactRequest } from '@haflow/shared';
import { missionStore } from '../services/mission-store.js';
import { missionEngine } from '../services/mission-engine.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const missionRoutes = Router();

// GET /api/missions - List all missions
missionRoutes.get('/', async (req, res, next) => {
  try {
    const missions = await missionStore.listMissions();
    sendSuccess(res, missions);
  } catch (err) {
    next(err);
  }
});

// GET /api/missions/:missionId - Get mission detail
missionRoutes.get('/:missionId', async (req, res, next) => {
  try {
    const { missionId } = req.params;
    const detail = await missionStore.getDetail(missionId);

    if (!detail) {
      return sendError(res, `Mission not found: ${missionId}`, 404);
    }

    sendSuccess(res, detail);
  } catch (err) {
    next(err);
  }
});

// POST /api/missions - Create mission
missionRoutes.post('/', async (req, res, next) => {
  try {
    const { title, type, rawInput } = req.body as CreateMissionRequest;

    if (!title || !type || !rawInput) {
      return sendError(res, 'Missing required fields: title, type, rawInput', 400);
    }

    const meta = await missionStore.createMission(title, type, rawInput);
    sendSuccess(res, meta, 201);
  } catch (err) {
    next(err);
  }
});

// PUT /api/missions/:missionId/artifacts/:filename - Save artifact
missionRoutes.put('/:missionId/artifacts/:filename', async (req, res, next) => {
  try {
    const { missionId, filename } = req.params;
    const { content } = req.body as SaveArtifactRequest;

    const meta = await missionStore.getMeta(missionId);
    if (!meta) {
      return sendError(res, `Mission not found: ${missionId}`, 404);
    }

    await missionStore.saveArtifact(missionId, filename, content);
    await missionStore.updateMeta(missionId, {}); // Touch updated_at

    sendSuccess(res, null);
  } catch (err) {
    next(err);
  }
});

// POST /api/missions/:missionId/continue - Continue mission
missionRoutes.post('/:missionId/continue', async (req, res, next) => {
  try {
    const { missionId } = req.params;

    const meta = await missionStore.getMeta(missionId);
    if (!meta) {
      return sendError(res, `Mission not found: ${missionId}`, 404);
    }

    await missionEngine.continueMission(missionId);
    sendSuccess(res, null);
  } catch (err) {
    next(err);
  }
});

// POST /api/missions/:missionId/mark-completed - Force complete
missionRoutes.post('/:missionId/mark-completed', async (req, res, next) => {
  try {
    const { missionId } = req.params;

    const meta = await missionStore.getMeta(missionId);
    if (!meta) {
      return sendError(res, `Mission not found: ${missionId}`, 404);
    }

    await missionStore.updateMeta(missionId, { status: 'completed' });
    sendSuccess(res, null);
  } catch (err) {
    next(err);
  }
});
```

### Success Criteria:

#### Automated Verification:
- [x] `curl -X POST localhost:4000/api/missions -H "Content-Type: application/json" -d '{"title":"test","type":"feature","rawInput":"hello"}'` returns 201
- [x] `curl localhost:4000/api/missions` returns array with the created mission
- [x] `curl localhost:4000/api/missions/<id>` returns full mission detail

#### Manual Verification:
- [ ] Frontend with `VITE_USE_MOCKS=false` can create and list missions

---

## Phase 4: Sandbox Provider Interface

### Overview
Define the abstract sandbox provider interface that the mission engine will use. This allows swapping Docker for k3s later.

### Changes Required:

#### 1. Provider Interface
**File**: `packages/backend/src/services/sandbox.ts`
```typescript
export interface SandboxRunOptions {
  missionId: string;
  runId: string;
  stepId: string;
  image: string;
  command: string[];
  env?: Record<string, string>;
  workingDir?: string;
  artifactsPath: string;  // Host path to mount
  labels?: Record<string, string>;
}

export interface SandboxStatus {
  state: 'running' | 'exited' | 'unknown';
  exitCode?: number;
  startedAt?: string;
  finishedAt?: string;
}

export interface SandboxProvider {
  /**
   * Start a new sandbox for a step run
   * Returns the container/job ID
   */
  start(options: SandboxRunOptions): Promise<string>;

  /**
   * Get status of a sandbox
   */
  getStatus(containerId: string): Promise<SandboxStatus>;

  /**
   * Get log tail from a sandbox
   */
  getLogTail(containerId: string, bytes?: number): Promise<string>;

  /**
   * Stop a running sandbox
   */
  stop(containerId: string): Promise<void>;

  /**
   * Remove a sandbox (cleanup)
   */
  remove(containerId: string): Promise<void>;

  /**
   * Check if provider is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Cleanup orphaned resources (e.g., containers with haflow labels)
   */
  cleanupOrphaned(): Promise<void>;
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles with interface definition
- [x] Interface can be imported from other modules

---

## Phase 5: Docker Provider Implementation

### Overview
Implement the SandboxProvider interface using Docker CLI (shelling out for v0, can move to Docker API later).

### Changes Required:

#### 1. Docker Provider
**File**: `packages/backend/src/services/docker.ts`
```typescript
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import type { SandboxProvider, SandboxRunOptions, SandboxStatus } from './sandbox.js';

const execAsync = promisify(exec);

const LABEL_PREFIX = 'haflow';

const defaultImage = 'node:20-slim'; // Default agent image for v0

async function isAvailable(): Promise<boolean> {
  try {
    await execAsync('docker version');
    return true;
  } catch {
    return false;
  }
}

async function start(options: SandboxRunOptions): Promise<string> {
    const {
      missionId,
      runId,
      stepId,
      image,
      command,
      env = {},
      workingDir = '/mission',
      artifactsPath,
    } = options;

    const labels = [
      `--label=${LABEL_PREFIX}.mission_id=${missionId}`,
      `--label=${LABEL_PREFIX}.run_id=${runId}`,
      `--label=${LABEL_PREFIX}.step_id=${stepId}`,
    ];

    const envArgs = Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]);

    const args = [
      'run',
      '-d',
      '--rm',
      ...labels,
      ...envArgs,
      '-v', `${artifactsPath}:${workingDir}/artifacts`,
      '-w', workingDir,
      image || defaultImage,
      ...command,
    ];

    const { stdout } = await execAsync(`docker ${args.join(' ')}`);
    const containerId = stdout.trim();

    return containerId;
}

async function getStatus(containerId: string): Promise<SandboxStatus> {
  try {
    const { stdout } = await execAsync(
      `docker inspect --format='{{.State.Status}}|{{.State.ExitCode}}|{{.State.StartedAt}}|{{.State.FinishedAt}}' ${containerId}`
    );

    const [status, exitCode, startedAt, finishedAt] = stdout.trim().split('|');

    const state = status === 'running' ? 'running' :
                  status === 'exited' ? 'exited' : 'unknown';

    return {
      state,
      exitCode: state === 'exited' ? parseInt(exitCode, 10) : undefined,
      startedAt: startedAt !== '0001-01-01T00:00:00Z' ? startedAt : undefined,
      finishedAt: finishedAt !== '0001-01-01T00:00:00Z' ? finishedAt : undefined,
    };
  } catch {
    return { state: 'unknown' };
  }
}

async function getLogTail(containerId: string, bytes = 2000): Promise<string> {
  try {
    const { stdout } = await execAsync(`docker logs --tail 100 ${containerId} 2>&1`);
    return stdout.slice(-bytes);
  } catch {
    return '';
  }
}

async function stop(containerId: string): Promise<void> {
  try {
    await execAsync(`docker stop ${containerId}`);
  } catch {
    // Ignore errors (container may already be stopped)
  }
}

async function remove(containerId: string): Promise<void> {
  try {
    await execAsync(`docker rm -f ${containerId}`);
  } catch {
    // Ignore errors (container may already be removed)
  }
}

async function cleanupOrphaned(): Promise<void> {
  try {
    // Find and remove all containers with haflow labels
    const { stdout } = await execAsync(
      `docker ps -aq --filter="label=${LABEL_PREFIX}.mission_id"`
    );

    const containerIds = stdout.trim().split('\n').filter(Boolean);

    for (const id of containerIds) {
      await remove(id);
    }
  } catch {
    // Ignore cleanup errors on startup
  }
}

export const dockerProvider: SandboxProvider = {
  start,
  getStatus,
  getLogTail,
  stop,
  remove,
  isAvailable,
  cleanupOrphaned,
};
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @haflow/backend build` compiles without errors
- [ ] `docker run --rm node:20-slim echo "hello"` works manually

#### Manual Verification:
- [ ] After starting a sandbox, `docker ps` shows container with haflow labels
- [ ] `docker logs <container_id>` shows output

---

## Phase 6: Mission Engine (Orchestration)

### Overview
Implement the mission engine that handles the `continue` action - advancing through workflow steps, starting agent sandboxes, and handling human gate approvals.

### Changes Required:

#### 1. Mission Engine
**File**: `packages/backend/src/services/mission-engine.ts`
```typescript
import { join } from 'path';
import type { MissionMeta, MissionStatus, WorkflowStep } from '@haflow/shared';
import { missionStore } from './mission-store.js';
import { getDefaultWorkflow } from './workflow.js';
import { dockerProvider } from './docker.js';
import type { SandboxProvider } from './sandbox.js';
import { config } from '../utils/config.js';

const provider: SandboxProvider = dockerProvider;
const runningContainers: Map<string, string> = new Map(); // runId -> containerId

async function init(): Promise<void> {
  // Check provider availability
  const available = await provider.isAvailable();
  if (!available) {
    console.warn('Sandbox provider (Docker) not available. Agent steps will fail.');
  }

  // Cleanup orphaned containers from previous runs
  await provider.cleanupOrphaned();
}

async function continueMission(missionId: string): Promise<void> {
  const meta = await missionStore.getMeta(missionId);
  if (!meta) throw new Error(`Mission not found: ${missionId}`);

  const workflow = getDefaultWorkflow();
  const currentStep = workflow.steps[meta.current_step];

  if (!currentStep) {
    // All steps complete
    await missionStore.updateMeta(missionId, { status: 'completed' });
    return;
  }

  if (currentStep.type === 'human-gate') {
    // Human approved - advance to next step
    await advanceToNextStep(missionId, meta);
  } else if (currentStep.type === 'agent') {
    // Start agent run
    await startAgentStep(missionId, meta, currentStep);
  }
}

async function advanceToNextStep(missionId: string, meta: MissionMeta): Promise<void> {
  const workflow = getDefaultWorkflow();
  const nextStepIndex = meta.current_step + 1;
  const nextStep = workflow.steps[nextStepIndex];

  if (!nextStep) {
    // Mission complete
    await missionStore.updateMeta(missionId, {
      status: 'completed',
      current_step: nextStepIndex,
    });
    return;
  }

  // Determine new status based on next step type
  const newStatus: MissionStatus = nextStep.type === 'human-gate'
    ? 'waiting_human'
    : 'ready';

  await missionStore.updateMeta(missionId, {
    status: newStatus,
    current_step: nextStepIndex,
  });

  // If next step is an agent, start it automatically
  if (nextStep.type === 'agent') {
    await startAgentStep(missionId, { ...meta, current_step: nextStepIndex }, nextStep);
  }
}

async function startAgentStep(
  missionId: string,
  meta: MissionMeta,
  step: WorkflowStep
): Promise<void> {
  // Create run record
  const run = await missionStore.createRun(missionId, step.step_id);

  // Update mission status
  await missionStore.updateMeta(missionId, { status: 'running_code_agent' });

  try {
    // Get artifact paths
    const artifactsPath = join(config.missionsDir, missionId, 'artifacts');
    const inputArtifact = step.inputArtifact || 'raw-input.md';
    const outputArtifact = step.outputArtifact || 'output.md';

    // For v0, we use a simple "mock agent" that just copies/transforms the input
    // In production, this would be the actual Claude agent container
    const containerId = await provider.start({
      missionId,
      runId: run.run_id,
      stepId: step.step_id,
      image: 'node:20-slim',
      artifactsPath,
      command: [
        'sh', '-c',
        // Simple mock: copy input to output with header
        `echo "# Output from ${step.name}" > /mission/artifacts/${outputArtifact} && ` +
        `echo "" >> /mission/artifacts/${outputArtifact} && ` +
        `echo "Processed by: ${step.agent || step.step_id}" >> /mission/artifacts/${outputArtifact} && ` +
        `echo "" >> /mission/artifacts/${outputArtifact} && ` +
        `cat /mission/artifacts/${inputArtifact} >> /mission/artifacts/${outputArtifact} && ` +
        `echo "Agent ${step.name} completed successfully"`
      ],
    });

    // Store container ID
    await missionStore.updateRun(missionId, run.run_id, { container_id: containerId });
    runningContainers.set(run.run_id, containerId);

    // Start monitoring the container
    monitorContainer(missionId, run.run_id, containerId);

  } catch (err) {
    // Agent failed to start
    const error = err instanceof Error ? err.message : String(err);
    await missionStore.updateRun(missionId, run.run_id, {
      finished_at: new Date().toISOString(),
      exit_code: 1,
    });
    await missionStore.updateMeta(missionId, {
      status: 'failed',
      errors: [...meta.errors, error],
      last_error: error,
    });
  }
}

async function monitorContainer(missionId: string, runId: string, containerId: string): Promise<void> {
  const checkInterval = setInterval(async () => {
    try {
      const status = await provider.getStatus(containerId);

      // Capture logs
      const logs = await provider.getLogTail(containerId);
      if (logs) {
        await missionStore.appendLog(missionId, runId, logs);
      }

      if (status.state === 'exited') {
        clearInterval(checkInterval);
        runningContainers.delete(runId);

        // Update run record
        await missionStore.updateRun(missionId, runId, {
          finished_at: status.finishedAt || new Date().toISOString(),
          exit_code: status.exitCode,
        });

        const meta = await missionStore.getMeta(missionId);
        if (!meta) return;

        if (status.exitCode === 0) {
          // Success - advance to next step
          await advanceToNextStep(missionId, meta);
        } else {
          // Failed
          const error = `Agent exited with code ${status.exitCode}`;
          await missionStore.updateMeta(missionId, {
            status: 'failed',
            errors: [...meta.errors, error],
            last_error: error,
          });
        }
      }
    } catch (err) {
      console.error(`Error monitoring container ${containerId}:`, err);
    }
  }, 1000); // Check every second
}

async function getRunningLogTail(missionId: string, runId: string): Promise<string | undefined> {
  const containerId = runningContainers.get(runId);
  if (!containerId) return undefined;

  return provider.getLogTail(containerId);
}

export const missionEngine = {
  init,
  continueMission,
  getRunningLogTail,
};
```

#### 2. Update server to initialize engine
**File**: `packages/backend/src/index.ts` (updated)
```typescript
import { createServer } from './server.js';
import { config } from './utils/config.js';
import { missionStore } from './services/mission-store.js';
import { missionEngine } from './services/mission-engine.js';

async function main() {
  // Initialize stores and engine
  await missionStore.init();
  await missionEngine.init();

  const app = createServer();

  app.listen(config.port, () => {
    console.log(`haflow backend listening on port ${config.port}`);
    console.log(`Missions directory: ${config.missionsDir}`);
  });
}

main().catch(console.error);
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @haflow/backend build` compiles without errors
- [ ] `curl -X POST localhost:4000/api/missions/<id>/continue` advances the mission
- [ ] Container starts and runs (visible in `docker ps`)

#### Manual Verification:
- [ ] After continue, mission moves from `ready` to `running_code_agent`
- [ ] After agent completes, mission moves to `waiting_human` for the human gate
- [ ] `current_log_tail` shows agent output during polling
- [ ] Output artifact is written to disk

---

## Phase 7: Integration Testing

### Overview
Ensure the full end-to-end flow works with the frontend.

### Success Criteria:

#### Automated Verification:
- [x] Backend starts without errors: `pnpm --filter @haflow/backend dev`
- [ ] Frontend connects successfully: `VITE_USE_MOCKS=false pnpm --filter frontend dev`

#### Manual Verification:
- [ ] Create mission from UI
- [ ] See mission in sidebar
- [ ] Mission shows `ready` status
- [ ] Click Continue, see `running_code_agent`
- [ ] See log output in UI
- [ ] Agent completes, mission shows `waiting_human`
- [ ] Edit artifact in markdown editor
- [ ] Click Continue/Approve
- [ ] Repeat through all 8 steps
- [ ] Mission reaches `completed` status

---

## Testing Strategy

### Unit Tests:
- Mission store: CRUD operations, artifact handling
- Workflow store: Returns correct workflow
- Response helpers: Correct JSON structure
- Docker provider: Parse status output (mock docker commands)

### Integration Tests:
- API endpoints: Full request/response cycle with mock store
- Mission engine: State machine transitions with mock provider

### Manual Testing Steps:
1. Start backend: `pnpm --filter @haflow/backend dev`
2. Start frontend: `VITE_USE_MOCKS=false pnpm --filter frontend dev`
3. Create new mission with sample input
4. Verify mission appears in sidebar
5. Click Continue to start first agent
6. Watch logs appear in UI
7. Complete full workflow cycle

## File Summary

New files to create in `packages/backend/src/`:

```
src/
├── index.ts
├── server.ts
├── routes/
│   └── missions.ts
├── services/
│   ├── mission-store.ts
│   ├── workflow.ts
│   ├── sandbox.ts
│   ├── docker.ts
│   └── mission-engine.ts
└── utils/
    ├── config.ts
    ├── response.ts
    └── id.ts
```

## References

- Working spec: `haflow-v0-working-spec.md`
- Shared types: `packages/shared/src/types.ts`
- Frontend mock data: `packages/frontend/src/mocks/data.ts`
- Frontend API client: `packages/frontend/src/api/client.ts`
