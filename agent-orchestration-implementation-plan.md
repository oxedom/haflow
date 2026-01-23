# Agent Orchestration System - Implementation Plan

## Overview

Build a local-first orchestration dashboard for running autonomous coding missions in isolated Docker containers. The system uses filesystem as source of truth, with missions progressing through configured workflows of agent steps and human gates.

## Current State Analysis (Updated 2025-01-22)

### What's IMPLEMENTED

#### Shared Package (`@haloop/shared`) - COMPLETE

#### Frontend (`packages/frontend`) - COMPLETE

#### Backend - None 

### What's MISSING

#### Backend - NOT IMPLEMENTED
- Express server (`src/index.ts`)
- API routes (`src/routes/missions.ts`)
- Filesystem service (`src/services/filesystem.ts`)
- Container management service (`src/services/container.ts`) (K3)

#### Config Files - NOT CREATED
- `config/workflows.json`
- `config/agents.json`
- `missions/` directory structure

---

## Desired End State

A working v0 system where:
1. Users can create missions via web UI
2. Missions progress through workflow steps (agent + human gates)
3. Agent steps run in ephemeral Docker containers / LLM calls from the API (Docker containers only for implemention)
4. Human gates show editor with artifacts for review and modify
5. All state persists to filesystem (mission.json, artifacts/, logs/, runs/)
6. Frontend polls backend for real-time updates

## What We're NOT Doing (v0 Scope)

- NOT Multiple workflow types (single "standard feature" workflow only)
- NOT Authentication/authorization
- NOT Network toggle for Docker (always enabled)
- NOT Concurrent mission limits
- NOT Git integration / automatic PR creation
- NOT WebSocket real-time updates (polling only)

---



## Phase 3: Frontend UI Components - COMPLETE needs to connect to backend and wire it up

## Phase 4: Backend - Config Files & Filesystem Service

### Overview
Create config files and implement filesystem operations for mission management.

### Changes Required

#### 1. Create Config Directory and Files

**File**: `config/workflows.json` (consumed by frontend and backend)

```json
{
  "workflows": [
    {
      "workflow_id": "standard-feature",
      "name": "Standard Feature",
      "steps": [
        {
          "step_id": "cleanup",
          "name": "Cleanup & Structure",
          "type": "agent",
          "agent": "cleanup-agent",
          "inputArtifact": "raw-input.md",
          "outputArtifact": "structured-text.md"
        },
        {
          "step_id": "review-structured",
          "name": "Review Structured Input",
          "type": "human-gate",
          "reviewArtifact": "structured-text.md"
        },
        {
          "step_id": "research",
          "name": "Research",
          "type": "agent",
          "agent": "research-agent",
          "inputArtifact": "structured-text.md",
          "outputArtifact": "research-output.md"
        },
        {
          "step_id": "review-research",
          "name": "Review Research",
          "type": "human-gate",
          "reviewArtifact": "research-output.md"
        },
        {
          "step_id": "planning",
          "name": "Planning",
          "type": "agent",
          "agent": "planning-agent",
          "inputArtifact": "research-output.md",
          "outputArtifact": "implementation-plan.md"
        },
        {
          "step_id": "review-plan",
          "name": "Review Plan",
          "type": "human-gate",
          "reviewArtifact": "implementation-plan.md"
        },
        {
          "step_id": "implementation",
          "name": "Implementation",
          "type": "agent",
          "agent": "implementation-agent",
          "inputArtifact": "implementation-plan.md",
          "outputArtifact": "implementation-result.json"
        },
        {
          "step_id": "review-implementation",
          "name": "Review Implementation",
          "type": "human-gate",
          "reviewArtifact": "implementation-result.json"
        }
      ]
    }
  ]
}
```

**File**: `config/agents.json`

```json
{
  "agents": {
    "cleanup-agent": {
      "promptFile": ".claude/agents/cleanup.md"
    },
    "research-agent": {
      "promptFile": ".claude/agents/research.md"
    },
    "planning-agent": {
      "promptFile": ".claude/agents/planning.md"
    },
    "implementation-agent": {
      "promptFile": ".claude/agents/implementation.md"
    }
  }
}
```


## Folder Structure (v0)

```
/missions
  /active
    /<mission-id>--<slug-title>/
      mission.json
      /artifacts
        raw-input.md
        structured-text.md
        research-output.md
        implementation-plan.md
        ...
      /logs
        step-01-cleanup.<runId>.log
        step-03-research.<runId>.log
        ...
      /runs
        step-01-cleanup.<runId>.json   # metadata (exitCode, startedAt, finishedAt, containerId)
        ...
  /completed
    /<mission-id>--<slug-title>/
      (frozen snapshot)
      
/config
  workflows.json
  agents.json (optional mapping of agent name -> command template)
```


Agent prompt files in `.claude/agents/` define the agent behavior. The container service reads the prompt file and passes it to Claude CLI.

#### 2. Filesystem Service

**File**: `packages/backend/src/services/filesystem.ts`

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import { MissionMeta, StepRun, Workflow } from '@haloop/shared';

const MISSIONS_DIR = path.join(process.cwd(), 'missions');
const CONFIG_DIR = path.join(process.cwd(), 'config');

// Initialize directory structure
export async function init(): Promise<void> {
  await fs.mkdir(path.join(MISSIONS_DIR, 'active'), { recursive: true });
  await fs.mkdir(path.join(MISSIONS_DIR, 'completed'), { recursive: true });
}

// Generate unique mission ID
export function generateMissionId(): string {
  return `m-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Get mission folder path
export function getMissionPath(missionId: string, title: string, completed = false): string {
  const slug = title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const folder = completed ? 'completed' : 'active';
  return path.join(MISSIONS_DIR, folder, `${missionId}--${slug}`);
}

// Find mission path by ID (searches both active and completed)
export async function findMissionPath(missionId: string): Promise<string | null> {
  for (const folder of ['active', 'completed']) {
    const dir = path.join(MISSIONS_DIR, folder);
    try {
      const dirs = await fs.readdir(dir);
      const match = dirs.find(d => d.startsWith(missionId));
      if (match) return path.join(dir, match);
    } catch {
      continue;
    }
  }
  return null;
}

// Create new mission folder structure
export async function createMission(meta: MissionMeta): Promise<string> {
  const missionPath = getMissionPath(meta.mission_id, meta.title);

  await fs.mkdir(missionPath, { recursive: true });
  await fs.mkdir(path.join(missionPath, 'artifacts'), { recursive: true });
  await fs.mkdir(path.join(missionPath, 'logs'), { recursive: true });
  await fs.mkdir(path.join(missionPath, 'runs'), { recursive: true });

  await fs.writeFile(
    path.join(missionPath, 'mission.json'),
    JSON.stringify(meta, null, 2)
  );

  return missionPath;
}

// Read mission metadata
export async function getMissionMeta(missionPath: string): Promise<MissionMeta> {
  const content = await fs.readFile(
    path.join(missionPath, 'mission.json'),
    'utf-8'
  );
  return JSON.parse(content);
}

// Update mission metadata
export async function updateMissionMeta(missionPath: string, meta: Partial<MissionMeta>): Promise<void> {
  const current = await getMissionMeta(missionPath);
  const updated = { ...current, ...meta, updated_at: new Date().toISOString() };
  await fs.writeFile(
    path.join(missionPath, 'mission.json'),
    JSON.stringify(updated, null, 2)
  );
}

// Read artifact content
export async function readArtifact(missionPath: string, filename: string): Promise<string | null> {
  try {
    return await fs.readFile(
      path.join(missionPath, 'artifacts', filename),
      'utf-8'
    );
  } catch {
    return null;
  }
}

// Write artifact content
export async function writeArtifact(missionPath: string, filename: string, content: string): Promise<void> {
  await fs.writeFile(
    path.join(missionPath, 'artifacts', filename),
    content
  );
}

// List all artifacts
export async function listArtifacts(missionPath: string): Promise<Record<string, string>> {
  const artifactsDir = path.join(missionPath, 'artifacts');
  try {
    const files = await fs.readdir(artifactsDir);
    const artifacts: Record<string, string> = {};

    for (const file of files) {
      artifacts[file] = await fs.readFile(path.join(artifactsDir, file), 'utf-8');
    }

    return artifacts;
  } catch {
    return {};
  }
}

// Write step run metadata
export async function writeStepRun(missionPath: string, run: StepRun): Promise<void> {
  await fs.writeFile(
    path.join(missionPath, 'runs', `${run.step_id}.${run.run_id}.json`),
    JSON.stringify(run, null, 2)
  );
}

// List step runs
export async function listStepRuns(missionPath: string): Promise<StepRun[]> {
  const runsDir = path.join(missionPath, 'runs');
  try {
    const files = await fs.readdir(runsDir);
    const runs: StepRun[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(path.join(runsDir, file), 'utf-8');
        runs.push(JSON.parse(content));
      }
    }

    return runs.sort((a, b) => a.started_at.localeCompare(b.started_at));
  } catch {
    return [];
  }
}

// Append to log file
export async function appendLog(missionPath: string, stepId: string, runId: string, content: string): Promise<void> {
  const logPath = path.join(missionPath, 'logs', `${stepId}.${runId}.log`);
  await fs.appendFile(logPath, content);
}

// Read log tail
export async function readLogTail(missionPath: string, stepId: string, runId: string, bytes = 4000): Promise<string> {
  const logPath = path.join(missionPath, 'logs', `${stepId}.${runId}.log`);
  try {
    const stats = await fs.stat(logPath);
    const start = Math.max(0, stats.size - bytes);
    const handle = await fs.open(logPath, 'r');
    const buffer = Buffer.alloc(Math.min(bytes, stats.size));
    await handle.read(buffer, 0, buffer.length, start);
    await handle.close();
    return buffer.toString('utf-8');
  } catch {
    return '';
  }
}

// List all active missions
export async function listActiveMissions(): Promise<string[]> {
  const activeDir = path.join(MISSIONS_DIR, 'active');
  try {
    const dirs = await fs.readdir(activeDir);
    return dirs.map(d => path.join(activeDir, d));
  } catch {
    return [];
  }
}

// Move mission to completed
export async function completeMission(missionPath: string): Promise<void> {
  const meta = await getMissionMeta(missionPath);
  const completedPath = getMissionPath(meta.mission_id, meta.title, true);
  await fs.rename(missionPath, completedPath);
}

// Load workflows config
export async function loadWorkflows(): Promise<Workflow[]> {
  const content = await fs.readFile(
    path.join(CONFIG_DIR, 'workflows.json'),
    'utf-8'
  );
  return JSON.parse(content).workflows;
}

// Load agents config
export async function loadAgents(): Promise<Record<string, { promptFile: string }>> {
  const content = await fs.readFile(
    path.join(CONFIG_DIR, 'agents.json'),
    'utf-8'
  );
  return JSON.parse(content).agents;
}
```

### Success Criteria

#### Automated Verification
- [ ] Config files created and valid JSON
- [ ] `pnpm --filter @haloop/backend build` succeeds
- [ ] Filesystem service compiles without errors

#### Manual Verification
- [ ] Can create mission folder with correct structure
- [ ] Can read/write artifacts
- [ ] Can load workflow/agent configs

---

## Phase 5: Backend - Container Service

### Overview
Wrap existing `runClaude()` from `claude-runner.ts` into a service module for agent execution.

### Changes Required

**File**: `packages/backend/src/services/container.ts`



#### Exported Functions

- `runAgent(runKey, promptFile, inputArtifact, outputArtifact, workDir, onOutput)` 

- `isRunning(runKey)` - Check if a run is currently active

- `getActiveRun(runKey)` - Get info about an active run (process, output so far, startedAt)

- `listActiveRuns()` - List all active run keys

- `killRun(runKey)` - Terminate a running container

#### Module State
- Tracks active by querying docker exec into container, docker ps, k3 methods
- Emits `'completed'` and `'error'` events for run lifecycle

### Success Criteria

#### Automated Verification
- [ ] TypeScript compilation passes

#### Manual Verification
- [ ] Agent commands execute in Docker sandbox
- [ ] Output streams correctly to callback
- [ ] Can kill running containers

---

## Phase 6: Backend - Express Server & API Routes

### Overview
Create Express server with REST API endpoints that frontend expects.

### Changes Required

#### 1. Express Server

**File**: `packages/backend/src/index.ts`

```typescript
import express from 'express';
import cors from 'cors';
import { missionRouter } from './routes/missions';
import { init } from './services/filesystem';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize filesystem
init().then(() => {
  console.log('Filesystem initialized');
});

// Routes
app.use('/api/missions', missionRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

#### 2. Mission Routes

**File**: `packages/backend/src/routes/missions.ts`

```typescript
import { Router, Request, Response } from 'express';
import * as fs from '../services/filesystem';
import * as container from '../services/container';
import { MissionMeta, MissionListItem, MissionDetail, ApiResponse, WorkflowStep } from '@haloop/shared';

export const missionRouter = Router();

// List all active missions
missionRouter.get('/', async (req: Request, res: Response) => {
  try {
    const missionPaths = await fs.listActiveMissions();
    const workflows = await fs.loadWorkflows();

    const missions: MissionListItem[] = await Promise.all(
      missionPaths.map(async (missionPath) => {
        const meta = await fs.getMissionMeta(missionPath);
        const workflow = workflows.find(w => w.workflow_id === meta.workflow_id);
        const currentStep = workflow?.steps[meta.current_step];

        return {
          mission_id: meta.mission_id,
          title: meta.title,
          type: meta.type,
          status: meta.status,
          current_step_name: currentStep?.name || 'Unknown',
          updated_at: meta.updated_at,
        };
      })
    );

    res.json({ success: true, data: missions } as ApiResponse<MissionListItem[]>);
  } catch (error) {
    res.status(500).json({ success: false, data: null, error: String(error) });
  }
});

// Get mission detail
missionRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const missionPath = await fs.findMissionPath(req.params.id);

    if (!missionPath) {
      return res.status(404).json({ success: false, data: null, error: 'Mission not found' });
    }

    const meta = await fs.getMissionMeta(missionPath);
    const workflows = await fs.loadWorkflows();
    const workflow = workflows.find(w => w.workflow_id === meta.workflow_id)!;
    const artifacts = await fs.listArtifacts(missionPath);
    const runs = await fs.listStepRuns(missionPath);

    // Get current log tail if agent running
    let current_log_tail: string | undefined;
    if (meta.status === 'running_code_agent') {
      const currentStep = workflow.steps[meta.current_step];
      const latestRun = runs.filter(r => r.step_id === currentStep.step_id).pop();
      if (latestRun) {
        current_log_tail = await fs.readLogTail(
          missionPath, currentStep.step_id, latestRun.run_id
        );
      }
    }

    const detail: MissionDetail = {
      ...meta,
      workflow,
      artifacts,
      runs,
      current_log_tail,
    };

    res.json({ success: true, data: detail } as ApiResponse<MissionDetail>);
  } catch (error) {
    res.status(500).json({ success: false, data: null, error: String(error) });
  }
});

// Create new mission
missionRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { title, type, rawInput } = req.body;

    const workflows = await fs.loadWorkflows();
    const workflow = workflows[0]; // Use first workflow for v0

    const meta: MissionMeta = {
      mission_id: fs.generateMissionId(),
      title,
      type,
      workflow_id: workflow.workflow_id,
      current_step: 0,
      status: 'ready',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      errors: [],
    };

    const missionPath = await fs.createMission(meta);
    await fs.writeArtifact(missionPath, 'raw-input.md', rawInput);

    res.json({ success: true, data: meta } as ApiResponse<MissionMeta>);
  } catch (error) {
    res.status(500).json({ success: false, data: null, error: String(error) });
  }
});

// Save artifact (for human gate edits)
missionRouter.put('/:id/artifacts/:filename', async (req: Request, res: Response) => {
  try {
    const missionPath = await fs.findMissionPath(req.params.id);

    if (!missionPath) {
      return res.status(404).json({ success: false, data: null, error: 'Mission not found' });
    }

    await fs.writeArtifact(missionPath, req.params.filename, req.body.content);
    res.json({ success: true, data: null, error: null });
  } catch (error) {
    res.status(500).json({ success: false, data: null, error: String(error) });
  }
});

// Continue to next step (advance from human gate or trigger agent)
missionRouter.post('/:id/continue', async (req: Request, res: Response) => {
  try {
    const missionPath = await fs.findMissionPath(req.params.id);

    if (!missionPath) {
      return res.status(404).json({ success: false, data: null, error: 'Mission not found' });
    }

    const meta = await fs.getMissionMeta(missionPath);
    const workflows = await fs.loadWorkflows();
    const workflow = workflows.find(w => w.workflow_id === meta.workflow_id)!;
    const agents = await fs.loadAgents();

    const currentStep = workflow.steps[meta.current_step];

    if (currentStep.type === 'human-gate') {
      // Advance to next step
      const nextStepIndex = meta.current_step + 1;

      if (nextStepIndex >= workflow.steps.length) {
        // Mission complete
        await fs.updateMissionMeta(missionPath, {
          status: 'completed',
          current_step: nextStepIndex,
        });
        await fs.completeMission(missionPath);
        return res.json({ success: true, data: { completed: true }, error: null });
      }

      const nextStep = workflow.steps[nextStepIndex];
      await fs.updateMissionMeta(missionPath, {
        current_step: nextStepIndex,
        status: nextStep.type === 'agent' ? 'ready' : 'waiting_human',
      });

      res.json({ success: true, data: null, error: null });
    } else if (currentStep.type === 'agent' && (meta.status === 'ready' || meta.status === 'failed')) {
      // Trigger the agent step
      await triggerAgentStep(missionPath, meta, currentStep, agents);
      res.json({ success: true, data: null, error: null });
    } else {
      res.status(400).json({ success: false, data: null, error: 'Cannot continue from current state' });
    }
  } catch (error) {
    res.status(500).json({ success: false, data: null, error: String(error) });
  }
});

// Mark failed mission as completed (manual override)
missionRouter.post('/:id/mark-completed', async (req: Request, res: Response) => {
  try {
    const missionPath = await fs.findMissionPath(req.params.id);

    if (!missionPath) {
      return res.status(404).json({ success: false, data: null, error: 'Mission not found' });
    }

    await fs.updateMissionMeta(missionPath, { status: 'completed' });
    await fs.completeMission(missionPath);

    res.json({ success: true, data: null, error: null });
  } catch (error) {
    res.status(500).json({ success: false, data: null, error: String(error) });
  }
});

// Helper: Trigger agent step execution
async function triggerAgentStep(
  missionPath: string,
  meta: MissionMeta,
  step: WorkflowStep,
  agents: Record<string, { promptFile: string }>
) {
  const agentConfig = agents[step.agent!];
  if (!agentConfig) throw new Error(`Agent not found: ${step.agent}`);

  const runId = `r-${Date.now()}`;
  const runKey = `${meta.mission_id}-${step.step_id}-${runId}`;

  // Update status to running
  await fs.updateMissionMeta(missionPath, { status: 'running_code_agent' });

  // Write initial run metadata
  await fs.writeStepRun(missionPath, {
    step_id: step.step_id,
    run_id: runId,
    started_at: new Date().toISOString(),
  });

  // Run container (async, don't await)
  container.runAgent(
    runKey,
    agentConfig.promptFile,
    step.inputArtifact || '',
    step.outputArtifact || '',
    missionPath,
    (data) => {
      fs.appendLog(missionPath, step.step_id, runId, data);
    }
  ).then(async ({ exitCode }) => {
    // Update run metadata
    await fs.writeStepRun(missionPath, {
      step_id: step.step_id,
      run_id: runId,
      started_at: new Date().toISOString(), // Should preserve original
      finished_at: new Date().toISOString(),
      exit_code: exitCode,
    });

    if (exitCode === 0) {
      // Advance to next step (human gate)
      const workflows = await fs.loadWorkflows();
      const workflow = workflows.find(w => w.workflow_id === meta.workflow_id)!;
      const nextStepIndex = meta.current_step + 1;

      if (nextStepIndex < workflow.steps.length) {
        await fs.updateMissionMeta(missionPath, {
          current_step: nextStepIndex,
          status: 'waiting_human',
        });
      } else {
        await fs.updateMissionMeta(missionPath, {
          status: 'completed',
        });
      }
    } else {
      // Mark as failed
      await fs.updateMissionMeta(missionPath, {
        status: 'failed',
        last_error: `Agent exited with code ${exitCode}`,
      });
    }
  });
}
```

### Success Criteria

#### Automated Verification
- [ ] `pnpm --filter @haloop/backend dev` starts server
- [ ] `curl http://localhost:4000/health` returns `{"status":"ok"}`
- [ ] TypeScript compiles without errors

#### Manual Verification
- [ ] Can create mission via POST
- [ ] Can list missions via GET
- [ ] Can get mission detail via GET
- [ ] Can save artifacts via PUT
- [ ] Can continue missions via POST

---

## Phase 7: Integration & End-to-End Testing

### Overview
Connect frontend to real backend, test complete workflow.

### Changes Required

#### 1. Update Frontend to Use Real API

**File**: `packages/frontend/.env`
```
VITE_USE_MOCKS=false
```

#### 2. Update package.json Scripts

**File**: `package.json` (root)
```json
{
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "dev:backend": "pnpm --filter @haloop/backend dev",
    "dev:frontend": "pnpm --filter frontend dev",
    "build": "pnpm -r build"
  }
}
```

### Success Criteria

#### Automated Verification
- [ ] `pnpm --filter @haloop/shared build` succeeds
- [ ] `pnpm --filter @haloop/backend build` succeeds
- [ ] `pnpm --filter frontend build` succeeds
- [ ] Backend starts: `pnpm --filter @haloop/backend dev`
- [ ] Frontend starts: `pnpm --filter frontend dev`

#### Manual Verification (End-to-End Flow)
- [ ] Create a new mission via UI
- [ ] Raw input saved to `missions/active/<id>/artifacts/raw-input.md`
- [ ] Click "Start Agent" triggers cleanup step
- [ ] Agent output streams to log viewer
- [ ] After agent completes, human gate shows editor
- [ ] Edit and save artifact
- [ ] Click Continue advances to next step
- [ ] Full workflow completes to end
- [ ] Mission moves to `missions/completed/`

---

## Next Steps

1. **Phase 4**: Create config files and filesystem service
2. **Phase 5**: Create container service wrapping runClaude
3. **Phase 6**: Create Express server and API routes
4. **Phase 7**: Integration testing

The frontend is complete and ready to connect to the backend once it's implemented.
