# Workflow Selection Feature Research

## Overview

This document captures research for adding a fullstack feature to toggle between workflows via a dropdown in the frontend.

**Goal**:
- Rename current workflow ID from `'standard-feature'` to `'raw-research-plan-implement'` and update display name to "Raw Research Plan Implement"
- Add a new "test" workflow with 3 steps (raw-input → process → review)
- Allow users to select workflow when creating a mission

---

## Current State Analysis

### Backend Workflow Definition

**File**: `packages/backend/src/services/workflow.ts`

**Current Structure** (lines 4-19):
```typescript
const WORKFLOWS: Record<string, Workflow> = {
  'standard-feature': {
    workflow_id: 'standard-feature',
    name: 'Standard Feature Workflow',
    steps: [
      { step_id: 'cleanup', name: 'Cleanup', type: 'agent', agent: 'haflow-cleanup-agent', inputArtifact: 'raw-input.md', outputArtifact: 'structured-text.md' },
      { step_id: 'review-structured', name: 'Review Structured', type: 'human-gate', reviewArtifact: 'structured-text.md' },
      { step_id: 'research', name: 'Research', type: 'agent', agent: 'haflow-research-agent', inputArtifact: 'structured-text.md', outputArtifact: 'research-output.md' },
      { step_id: 'review-research', name: 'Review Research', type: 'human-gate', reviewArtifact: 'research-output.md' },
      { step_id: 'planning', name: 'Planning', type: 'agent', agent: 'haflow-planning-agent', inputArtifact: 'research-output.md', outputArtifact: 'implementation-plan.md' },
      { step_id: 'review-plan', name: 'Review Plan', type: 'human-gate', reviewArtifact: 'implementation-plan.md' },
      { step_id: 'implementation', name: 'Implementation', type: 'agent', agent: 'haflow-impl-agent', inputArtifact: 'implementation-plan.md', outputArtifact: 'implementation-result.json' },
      { step_id: 'review-impl', name: 'Review Implementation', type: 'human-gate', reviewArtifact: 'implementation-result.json' },
    ],
  },
};
```

**Exported Functions**:
- `getStepPrompt(step)` - Returns Claude prompt for a step (lines 93-101)
- `getDefaultWorkflowId()` - Returns `'standard-feature'` (lines 103-105) - **Will change to `'raw-research-plan-implement'`**
- `getDefaultWorkflow()` - Returns the standard-feature workflow (lines 107-109) - **Will need to use `getWorkflowById` instead**
- `getWorkflowStepName(workflowId, stepIndex)` - Returns step name (lines 111-114)

### Mission Store Usage

**File**: `packages/backend/src/services/mission-store.ts`

**Mission Creation** (line 35):
```typescript
workflow_id: getDefaultWorkflowId(),  // Currently 'standard-feature', will change to 'raw-research-plan-implement'
```

**Detail Retrieval** (line 70):
```typescript
const workflow = getDefaultWorkflow();  // Ignores stored workflow_id
```

**List Display** (line 99):
```typescript
current_step_name: getWorkflowStepName(meta.workflow_id, meta.current_step),
```

### Mission Engine Usage

**File**: `packages/backend/src/services/mission-engine.ts`

**Step Retrieval** (lines 28-29):
```typescript
const workflow = getDefaultWorkflow();
const currentStep = workflow.steps[meta.current_step];
```

**Key Observation**: Engine always uses `getDefaultWorkflow()`, ignoring the stored `workflow_id`.

### API Routes

**File**: `packages/backend/src/routes/missions.ts`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/missions` | POST | Create mission (title, type, rawInput) - no workflowId param |
| `/api/missions/:id` | GET | Returns MissionDetail with workflow object |

### Frontend Mission Creation

**File**: `packages/frontend/src/components/NewMissionModal.tsx`

**Current Form Fields**:
- Title input (line 64-72)
- Type dropdown: feature/fix/bugfix (lines 74-87)
- Raw Input textarea (lines 89-106)

**No workflow selection UI exists.**

**API Client** (`packages/frontend/src/api/client.ts:26-38`):
```typescript
createMission: async (title, type, rawInput): Promise<MissionMeta>
```

### Shared Types

**File**: `packages/shared/src/schemas.ts`

**WorkflowSchema** (lines 32-36):
```typescript
export const WorkflowSchema = z.object({
  workflow_id: z.string(),
  name: z.string(),
  steps: z.array(WorkflowStepSchema),
});
```

**CreateMissionRequestSchema** (lines 89-93):
```typescript
export const CreateMissionRequestSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  type: MissionTypeSchema,
  rawInput: z.string().min(1, 'Raw input is required'),
});
```

---

## Decisions

### 1. Workflow ID Naming Strategy

**Decision**: Option B - Rename ID to `'raw-research-plan-implement'`

- **Pros**: ID matches display name, cleaner and more descriptive
- **Cons**: Breaking change for existing missions in `~/.haflow/missions/`
- **Migration Note**: Existing missions with `workflow_id: 'standard-feature'` will need to be migrated or handled with backwards compatibility logic

### 2. "Test" Workflow Steps

**Decision**: Option B - With raw input step (3 steps)

The test workflow will have the following structure:
1. `raw-input` (human-gate): User provides raw input
2. `process` (agent): raw-input.md → output.md
3. `review` (human-gate): review output.md

---

## Proposed Changes

### Phase 1: Backend - Multiple Workflows

**File**: `packages/backend/src/services/workflow.ts`

1. Rename `'standard-feature'` workflow ID to `'raw-research-plan-implement'` and update display name to "Raw Research Plan Implement"
2. Add `'test'` workflow to `WORKFLOWS` record with the following structure:
   ```typescript
   'test': {
     workflow_id: 'test',
     name: 'Test Workflow',
     steps: [
       { step_id: 'raw-input', name: 'Raw Input', type: 'human-gate', reviewArtifact: 'raw-input.md' },
       { step_id: 'process', name: 'Process', type: 'agent', agent: 'haflow-process-agent', inputArtifact: 'raw-input.md', outputArtifact: 'output.md' },
       { step_id: 'review', name: 'Review', type: 'human-gate', reviewArtifact: 'output.md' },
     ],
   }
   ```
3. Add new functions:
   - `getWorkflows(): Workflow[]` - Return all available workflows
   - `getWorkflowById(workflowId: string): Workflow | undefined`
4. Update existing functions to use `getWorkflowById` (replacing `getDefaultWorkflow()`)
5. Update `getDefaultWorkflowId()` to return `'raw-research-plan-implement'`
6. **Backwards Compatibility**: Add migration logic to handle existing missions with `workflow_id: 'standard-feature'` by mapping to `'raw-research-plan-implement'` when loading missions

**File**: `packages/backend/src/services/mission-store.ts`

1. Update `createMission` signature to accept optional `workflowId`
2. Update `getDetail` to use `getWorkflowById(meta.workflow_id)` instead of `getDefaultWorkflow()`

**File**: `packages/backend/src/services/mission-engine.ts`

1. Update `continueMission` to use `getWorkflowById(meta.workflow_id)`
2. Update `advanceToNextStep` similarly

### Phase 2: API - Expose Workflows

**File**: `packages/backend/src/routes/missions.ts`

1. Add `GET /api/workflows` endpoint returning list of workflows
2. Update `POST /api/missions` to accept optional `workflowId` in body

### Phase 3: Shared Types

**File**: `packages/shared/src/schemas.ts`

1. Update `CreateMissionRequestSchema`:
```typescript
export const CreateMissionRequestSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  type: MissionTypeSchema,
  rawInput: z.string().min(1, 'Raw input is required'),
  workflowId: z.string().optional(),  // NEW
});
```

### Phase 4: Frontend - Workflow Dropdown

**File**: `packages/frontend/src/api/client.ts`

1. Add `getWorkflows(): Promise<Workflow[]>` method
2. Update `createMission` to accept optional `workflowId`

**File**: `packages/frontend/src/components/NewMissionModal.tsx`

1. Fetch workflows on mount
2. Add workflow dropdown between Type and Raw Input
3. Pass selected `workflowId` to `onSubmit`

**File**: `packages/frontend/src/App.tsx`

1. Update `handleCreateMission` to accept `workflowId`
2. Pass to mutation

---

## Files to Modify

| File | Changes |
|------|---------|
| `packages/backend/src/services/workflow.ts` | Add test workflow, add helper functions |
| `packages/backend/src/services/mission-store.ts` | Accept workflowId in createMission |
| `packages/backend/src/services/mission-engine.ts` | Use getWorkflowById |
| `packages/backend/src/routes/missions.ts` | Add /api/workflows endpoint |
| `packages/shared/src/schemas.ts` | Add workflowId to CreateMissionRequestSchema |
| `packages/frontend/src/api/client.ts` | Add getWorkflows, update createMission |
| `packages/frontend/src/components/NewMissionModal.tsx` | Add workflow dropdown |
| `packages/frontend/src/App.tsx` | Pass workflowId through |

---

## Testing Considerations

### Backend Tests
- Unit tests for new workflow functions
- Integration tests for `/api/workflows` endpoint
- Update existing mission creation tests
- **Backwards compatibility tests**: Verify missions with old `'standard-feature'` workflow_id are handled correctly (migration or fallback logic)

### Frontend Tests
- Workflow dropdown renders with options
- Selected workflow passed to API
- Default workflow selected initially

### E2E Tests
- Create mission with non-default workflow
- Verify workflow steps display correctly
