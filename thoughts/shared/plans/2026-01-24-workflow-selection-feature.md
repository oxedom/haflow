# Workflow Selection Feature Implementation Plan

## Overview

Add the ability to select from multiple workflows when creating a mission. This includes renaming the existing workflow, adding a new "simple" workflow, and exposing workflow selection in the frontend.

## Current State Analysis

- Single hardcoded workflow `'standard-feature'` in `workflow.ts:4-19`
- `getDefaultWorkflow()` used everywhere, ignoring stored `workflow_id`
- No workflow selection UI exists
- `CreateMissionRequestSchema` lacks `workflowId` field

### Key Discoveries:
- `mission-store.ts:35` uses `getDefaultWorkflowId()` for new missions
- `mission-store.ts:70` uses `getDefaultWorkflow()` ignoring stored workflow_id
- `mission-engine.ts:28,47` uses `getDefaultWorkflow()` ignoring stored workflow_id
- Frontend `NewMissionModal.tsx` only passes title, type, rawInput

## Desired End State

1. Two workflows available:
   - `'raw-research-plan-implement'` (renamed from standard-feature) - 8 steps
   - `'simple'` - 3 steps (raw-input → process with planning-agent → review)
2. Users can select workflow via dropdown when creating missions
3. Mission engine respects stored `workflow_id`
4. API exposes `GET /api/workflows` endpoint

### Verification:
- Create mission with each workflow type
- Verify correct steps display for each
- Verify workflow persists and executes correctly

## What We're NOT Doing

- No backwards compatibility for existing `'standard-feature'` missions (user will manually clean up)
- No workflow editing/creation UI
- No workflow versioning

## Implementation Approach

Bottom-up: Backend types/functions first, then API, then frontend. This allows testing at each layer.

---

## Phase 1: Backend - Workflow Service Updates

### Overview
Update workflow.ts to support multiple workflows with proper lookup functions.

### Changes Required:

#### 1. Rename existing workflow and add simple workflow
**File**: `packages/backend/src/services/workflow.ts`

**Changes**:
- Rename `'standard-feature'` key and workflow_id to `'raw-research-plan-implement'`
- Update display name to "Raw Research Plan Implement"
- Add `'simple'` workflow with 3 steps
- Add `getWorkflows()` function
- Add `getWorkflowById()` function

```typescript
// Line 4-19: Replace WORKFLOWS definition
const WORKFLOWS: Record<string, Workflow> = {
  'raw-research-plan-implement': {
    workflow_id: 'raw-research-plan-implement',
    name: 'Raw Research Plan Implement',
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
  'simple': {
    workflow_id: 'simple',
    name: 'Simple',
    steps: [
      { step_id: 'raw-input', name: 'Raw Input', type: 'human-gate', reviewArtifact: 'raw-input.md' },
      { step_id: 'process', name: 'Process', type: 'agent', agent: 'planning-agent', inputArtifact: 'raw-input.md', outputArtifact: 'output.md' },
      { step_id: 'review', name: 'Review', type: 'human-gate', reviewArtifact: 'output.md' },
    ],
  },
};

// Line 103-105: Update getDefaultWorkflowId
export function getDefaultWorkflowId(): string {
  return 'raw-research-plan-implement';
}

// Add after getDefaultWorkflow (around line 109):
export function getWorkflows(): Workflow[] {
  return Object.values(WORKFLOWS);
}

export function getWorkflowById(workflowId: string): Workflow | undefined {
  return WORKFLOWS[workflowId];
}
```

### Success Criteria:

#### Automated Verification:
- [x] Build succeeds: `pnpm --filter @haflow/backend build`
- [x] Existing tests pass: `pnpm --filter @haflow/backend test`

#### Manual Verification:
- [x] N/A for this phase

---

## Phase 2: Backend - Mission Store & Engine Updates

### Overview
Update mission-store and mission-engine to use `getWorkflowById()` instead of `getDefaultWorkflow()`.

### Changes Required:

#### 1. Update mission-store.ts
**File**: `packages/backend/src/services/mission-store.ts`

**Changes**:
- Update import to include `getWorkflowById`
- Update `createMission` to accept optional `workflowId` parameter
- Update `getDetail` to use `getWorkflowById(meta.workflow_id)`

```typescript
// Line 7: Update import
import { getDefaultWorkflow, getDefaultWorkflowId, getWorkflowStepName, getWorkflowById } from './workflow.js';

// Lines 23-26: Update createMission signature
async function createMission(
  title: string,
  type: MissionType,
  rawInput: string,
  workflowId?: string
): Promise<MissionMeta> {

// Line 35: Use provided workflowId or default
workflow_id: workflowId || getDefaultWorkflowId(),

// Line 70: Update getDetail to use stored workflow_id
const workflow = getWorkflowById(meta.workflow_id) || getDefaultWorkflow();
```

#### 2. Update mission-engine.ts
**File**: `packages/backend/src/services/mission-engine.ts`

**Changes**:
- Update import to include `getWorkflowById`
- Update `continueMission` to use `getWorkflowById(meta.workflow_id)`
- Update `advanceToNextStep` to use `getWorkflowById(meta.workflow_id)`

```typescript
// Line 4: Update import
import { getDefaultWorkflow, getStepPrompt, getWorkflowById } from './workflow.js';

// Line 28: Update continueMission
const workflow = getWorkflowById(meta.workflow_id) || getDefaultWorkflow();

// Line 47: Update advanceToNextStep
const workflow = getWorkflowById(meta.workflow_id) || getDefaultWorkflow();
```

### Success Criteria:

#### Automated Verification:
- [x] Build succeeds: `pnpm --filter @haflow/backend build`
- [x] All tests pass: `pnpm --filter @haflow/backend test`

#### Manual Verification:
- [x] N/A for this phase

---

## Phase 3: API & Shared Types

### Overview
Add `/api/workflows` endpoint and update `CreateMissionRequestSchema` to accept optional `workflowId`.

### Changes Required:

#### 1. Update shared schemas
**File**: `packages/shared/src/schemas.ts`

**Changes**: Add `workflowId` to `CreateMissionRequestSchema`

```typescript
// Lines 89-93: Update CreateMissionRequestSchema
export const CreateMissionRequestSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  type: MissionTypeSchema,
  rawInput: z.string().min(1, 'Raw input is required'),
  workflowId: z.string().optional(),
});
```

#### 2. Add workflows endpoint
**File**: `packages/backend/src/routes/missions.ts`

**Changes**:
- Import `getWorkflows` from workflow service
- Add `GET /api/workflows` endpoint
- Update `POST /api/missions` to pass `workflowId`

```typescript
// Line 4: Update import (add getWorkflows)
import { getWorkflows } from '../services/workflow.js';

// Add after line 7 (before mission routes):
export const workflowRoutes: Router = Router();

// GET /api/workflows - List all workflows
workflowRoutes.get('/', async (_req, res, next) => {
  try {
    const workflows = getWorkflows();
    sendSuccess(res, workflows);
  } catch (err) {
    next(err);
  }
});

// Line 44: Update POST /api/missions to include workflowId
const { title, type, rawInput, workflowId } = parsed.data;
const meta = await missionStore.createMission(title, type, rawInput, workflowId);
```

#### 3. Register workflow routes
**File**: `packages/backend/src/index.ts`

**Changes**: Import and register `workflowRoutes`

```typescript
// Add import
import { workflowRoutes } from './routes/missions.js';

// Add route registration (after missions routes)
app.use('/api/workflows', workflowRoutes);
```

### Success Criteria:

#### Automated Verification:
- [x] Shared build succeeds: `pnpm --filter @haflow/shared build`
- [x] Backend build succeeds: `pnpm --filter @haflow/backend build`
- [x] All tests pass: `pnpm --filter @haflow/backend test`

#### Manual Verification:
- [ ] `curl http://localhost:4000/api/workflows` returns both workflows

---

## Phase 4: Frontend - API Client & Modal Updates

### Overview
Add workflow fetching to API client and workflow dropdown to NewMissionModal.

### Changes Required:

#### 1. Update API client
**File**: `packages/frontend/src/api/client.ts`

**Changes**:
- Import `Workflow` type
- Add `getWorkflows()` method
- Update `createMission()` to accept optional `workflowId`

```typescript
// Line 2: Update import to include Workflow
import type { MissionListItem, MissionDetail, MissionMeta, ApiResponse, TranscriptionResponse, TranscriptionStatus, Workflow } from '@haflow/shared';

// Add after listMissions (around line 18):
getWorkflows: async (): Promise<Workflow[]> => {
  const res = await client.get<ApiResponse<Workflow[]>>('/workflows');
  if (!res.data.success) throw new Error(res.data.error || 'Failed to list workflows');
  return res.data.data!;
},

// Lines 26-38: Update createMission signature
createMission: async (
  title: string,
  type: string,
  rawInput: string,
  workflowId?: string
): Promise<MissionMeta> => {
  const res = await client.post<ApiResponse<MissionMeta>>('/missions', {
    title,
    type,
    rawInput,
    workflowId,
  });
  if (!res.data.success) throw new Error(res.data.error || 'Failed to create mission');
  return res.data.data!;
},
```

#### 2. Update NewMissionModal
**File**: `packages/frontend/src/components/NewMissionModal.tsx`

**Changes**:
- Add workflow state and fetch on mount
- Add workflow dropdown between Type and Raw Input
- Update `onSubmit` prop to include workflowId

```typescript
// Add imports
import { useEffect } from 'react'
import type { Workflow } from '@haflow/shared'
import { api } from '@/api/client'

// Update interface (lines 22-30)
interface NewMissionModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (
    title: string,
    type: 'feature' | 'fix' | 'bugfix',
    rawInput: string,
    workflowId: string
  ) => void
}

// Add state inside component (after line 36)
const [workflows, setWorkflows] = useState<Workflow[]>([])
const [workflowId, setWorkflowId] = useState<string>('')

// Add useEffect to fetch workflows (after state declarations)
useEffect(() => {
  if (isOpen) {
    api.getWorkflows().then((wfs) => {
      setWorkflows(wfs)
      if (wfs.length > 0 && !workflowId) {
        setWorkflowId(wfs[0].workflow_id)
      }
    })
  }
}, [isOpen])

// Update handleSubmit (line 44)
await onSubmit(title, type, rawInput, workflowId)

// Update reset (line 47)
setWorkflowId(workflows[0]?.workflow_id || '')

// Add workflow dropdown after Type dropdown (after line 87):
{/* Workflow */}
<div className="space-y-2">
  <Label htmlFor="workflow">Workflow</Label>
  <Select value={workflowId} onValueChange={setWorkflowId}>
    <SelectTrigger>
      <SelectValue placeholder="Select workflow" />
    </SelectTrigger>
    <SelectContent>
      {workflows.map((wf) => (
        <SelectItem key={wf.workflow_id} value={wf.workflow_id}>
          {wf.name} ({wf.steps.length} steps)
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

#### 3. Update App.tsx
**File**: `packages/frontend/src/App.tsx`

**Changes**: Update `handleCreateMission` to accept and pass `workflowId`

```typescript
// Lines 111-118: Update handleCreateMission
const handleCreateMission = async (
  title: string,
  type: 'feature' | 'fix' | 'bugfix',
  rawInput: string,
  workflowId: string
) => {
  const newMission = await createMissionMutation.mutateAsync({ title, type, rawInput, workflowId })
  setSelectedMissionId(newMission.mission_id)
}

// Lines 51-65: Update mutation type
const createMissionMutation = useMutation({
  mutationFn: async ({
    title,
    type,
    rawInput,
    workflowId,
  }: {
    title: string
    type: 'feature' | 'fix' | 'bugfix'
    rawInput: string
    workflowId: string
  }) => {
    return api.createMission(title, type, rawInput, workflowId)
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['missions'] })
  },
})
```

### Success Criteria:

#### Automated Verification:
- [x] Frontend build succeeds: `pnpm --filter frontend build`
- [x] Frontend lint passes: `pnpm --filter frontend lint` (no new errors from my changes)

#### Manual Verification:
- [ ] Workflow dropdown appears in New Mission modal
- [ ] Both workflows display with step counts
- [ ] Creating mission with "Simple" workflow shows 3 steps
- [ ] Creating mission with "Raw Research Plan Implement" shows 8 steps

---

## Testing Strategy

### Unit Tests:
- `getWorkflows()` returns array of both workflows
- `getWorkflowById('simple')` returns simple workflow
- `getWorkflowById('invalid')` returns undefined
- `createMission` with workflowId stores correct workflow_id

### Integration Tests:
- `GET /api/workflows` returns both workflows
- `POST /api/missions` with workflowId creates mission with correct workflow

### Manual Testing Steps:
1. Start backend and frontend
2. Click "New Mission" button
3. Verify workflow dropdown shows both options with step counts
4. Create mission with "Simple" workflow
5. Verify mission detail shows 3 steps
6. Create mission with "Raw Research Plan Implement" workflow
7. Verify mission detail shows 8 steps

## References

- Original research: `thoughts/shared/research/2026-01-24-workflow-selection-feature.md`
- Workflow service: `packages/backend/src/services/workflow.ts`
- Mission store: `packages/backend/src/services/mission-store.ts`
