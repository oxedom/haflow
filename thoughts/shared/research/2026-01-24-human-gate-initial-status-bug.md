---
date: 2026-01-24T14:30:00-05:00
researcher: Claude
git_commit: d9ec076d184e7ec0ade1380a1e4a1e54f3961fa0
branch: main
repository: haflow
topic: "Human-Gate Initial Status Bug Analysis"
tags: [research, codebase, mission-store, workflow, status, human-gate, frontend, bug-analysis]
status: complete
last_updated: 2026-01-24
last_updated_by: Claude
---

# Research: Human-Gate Initial Status Bug Analysis

**Date**: 2026-01-24T14:30:00-05:00
**Researcher**: Claude
**Git Commit**: d9ec076d184e7ec0ade1380a1e4a1e54f3961fa0
**Branch**: main
**Repository**: haflow

## Research Question

Analyze the human-gate initial status bug described in the ticket: When a workflow starts with a human-gate step (like the "Simple" workflow), users get stuck on the mission detail page because the initial status is always `'ready'` but the frontend only shows the editor when `status === 'waiting_human'`.

## Summary

**Key Finding**: The backend code correctly handles initial status determination for human-gate workflows. The `mission-store.ts:46-51` logic properly sets `'waiting_human'` status when the first step is a human-gate. However, **the frontend has a gap in its conditional rendering logic** that could cause issues in edge cases.

The actual bug manifestation depends on:
1. **Workflow selection default** - The first workflow in the list (`'raw-research-plan-implement'`) starts with an agent step
2. **Frontend conditional gap** - If `status === 'ready'` but `currentStep.type === 'human-gate'`, the editor is NOT shown
3. **Potential race conditions** - Brief `'ready'` state during status transitions

## Detailed Findings

### Backend: Initial Status Determination

**File**: `packages/backend/src/services/mission-store.ts:46-51`

```typescript
// Determine initial status based on first step type
const workflow = getWorkflowById(resolvedWorkflowId) || getDefaultWorkflow();
const firstStep = workflow.steps[0];
const initialStatus: MissionStatus = firstStep?.type === 'human-gate'
  ? 'waiting_human'
  : 'ready';
```

**Logic Flow**:
1. Resolves workflowId (uses default `'raw-research-plan-implement'` if not provided)
2. Looks up workflow definition
3. Checks if first step is `'human-gate'`
4. Sets status to `'waiting_human'` if true, `'ready'` if false

**Conclusion**: Backend logic is **CORRECT** for setting initial status.

### Workflow Definitions

**File**: `packages/backend/src/services/workflow.ts:4-28`

| Workflow ID | First Step | First Step Type | Initial Status |
|------------|------------|-----------------|----------------|
| `raw-research-plan-implement` (default) | `cleanup` | `agent` | `'ready'` |
| `simple` | `raw-input` | `human-gate` | `'waiting_human'` |

**Simple Workflow Definition** (lines 19-27):
```typescript
'simple': {
  workflow_id: 'simple',
  name: 'Simple',
  steps: [
    { step_id: 'raw-input', name: 'Raw Input', type: 'human-gate', reviewArtifact: 'raw-input.md' },
    { step_id: 'process', name: 'Process', type: 'agent', agent: 'planning-agent', inputArtifact: 'raw-input.md', outputArtifact: 'output.md' },
    { step_id: 'review', name: 'Review', type: 'human-gate', reviewArtifact: 'output.md' },
  ],
}
```

### Frontend: Status-Based Rendering

**File**: `packages/frontend/src/components/MissionDetail.tsx:238-381`

The component uses a cascading if-else chain for conditional rendering:

```typescript
// Line 238-251: Running states
if (mission.status === 'running_code_agent' || mission.status === 'running_root_llm') {
  // Show log viewer
}
// Line 252-334: Human gate editor - THE CRITICAL CHECK
else if (mission.status === 'waiting_human' && artifactName) {
  // Show editor with Save Draft and Continue buttons
}
// Line 335-356: Failed state
else if (mission.status === 'failed') {
  // Show error display
}
// Line 357-369: Ready to start agent
else if ((mission.status === 'ready' || mission.status === 'draft') && currentStep?.type === 'agent') {
  // Show "Start Agent" button
}
// Line 370-381: Fallback (everything else)
else {
  // Generic "Mission status: {status}" display
}
```

### The Bug: Frontend Conditional Gap

**Problem Scenario**: If `status === 'ready'` AND `currentStep.type === 'human-gate'`, the fallback branch is triggered instead of showing the editor.

| Status | Current Step Type | UI Displayed | Expected |
|--------|------------------|--------------|----------|
| `'waiting_human'` | `'human-gate'` | ✅ Editor | Editor |
| `'ready'` | `'agent'` | ✅ Start Agent button | Start Agent |
| `'ready'` | `'human-gate'` | ❌ **Fallback: "Mission status: ready"** | Editor |
| `'draft'` | `'human-gate'` | ❌ **Fallback: "Mission status: draft"** | Editor |

**When Can This Happen?**

1. **Backend logic failure** - If `getWorkflowById()` returns undefined and falls back to default workflow
2. **Race condition** - Brief window during `advanceToNextStep()` where status is `'ready'` but hasn't transitioned to `'running_code_agent'` yet
3. **Manual mission.json editing** - Corrupted mission state

### Frontend: Workflow Selection Default

**File**: `packages/frontend/src/components/NewMissionModal.tsx:67-70`

```typescript
api.getWorkflows().then((wfs) => {
  setWorkflows(wfs)
  // Only set default on first load
  setWorkflowId((prev) => prev || (wfs.length > 0 ? wfs[0].workflow_id : ''))
})
```

The default workflow is the **first one returned by the API**. Since `Object.values(WORKFLOWS)` returns values in insertion order, this is `'raw-research-plan-implement'` which starts with an agent step.

**Impact**: If users don't explicitly select 'simple' workflow, they get the default which starts with an agent and has status `'ready'`.

### Mission Engine: State Transitions

**File**: `packages/backend/src/services/mission-engine.ts`

**Status Transition Points**:

1. **Initial creation** (`mission-store.ts:49-51`): `'ready'` or `'waiting_human'` based on first step type
2. **advanceToNextStep** (`mission-engine.ts:61-63`):
   ```typescript
   const newStatus: MissionStatus = nextStep.type === 'human-gate'
     ? 'waiting_human'
     : 'ready';
   ```
3. **startAgentStep** (`mission-engine.ts:85`): Updates to `'running_code_agent'`
4. **Container completion**: Calls `advanceToNextStep()` for next status

**Auto-Start Optimization** (`mission-engine.ts:70-73`):
When advancing to an agent step, it immediately starts the agent:
```typescript
if (nextStep.type === 'agent') {
  await startAgentStep(missionId, { ...meta, current_step: nextStepIndex }, nextStep);
}
```

This creates a transient `'ready'` state that quickly transitions to `'running_code_agent'`.

### Possible Status Values

**File**: `packages/shared/src/schemas.ts:7-15`

```typescript
export const MissionStatusSchema = z.enum([
  'draft',              // Initial state, not started
  'ready',              // Ready to run
  'waiting_human',      // At a human gate
  'running_code_agent', // Agent container running
  'running_root_llm',   // Root LLM running
  'failed',             // Agent failed
  'completed',          // All steps done
]);
```

## Code References

- `packages/backend/src/services/mission-store.ts:46-51` - Initial status determination logic
- `packages/backend/src/services/workflow.ts:4-28` - Workflow definitions (WORKFLOWS object)
- `packages/backend/src/services/workflow.ts:112-114` - Default workflow ID function
- `packages/backend/src/services/mission-engine.ts:46-74` - advanceToNextStep function
- `packages/backend/src/services/mission-engine.ts:76-112` - startAgentStep function
- `packages/frontend/src/components/MissionDetail.tsx:238-381` - Conditional rendering logic
- `packages/frontend/src/components/MissionDetail.tsx:252` - Critical `waiting_human` check
- `packages/frontend/src/components/NewMissionModal.tsx:67-70` - Workflow selection default
- `packages/shared/src/schemas.ts:7-15` - MissionStatus enum definition

## Architecture Insights

### State Machine Design

The mission system uses a state machine where:
- Status reflects the **next action required**, not the current step type
- `'waiting_human'` = system is waiting for human input
- `'ready'` = system is ready to execute an agent step
- Status is determined by **looking ahead** to what the next step requires

### Frontend Polling

- Normal polling: Every 2000ms (`App.tsx:15`)
- Fast polling: Every 500ms when running (`App.tsx:40-46`)
- Stale time: 1000ms (`App.tsx:16`)

### Auto-Chaining Pattern

Agent steps auto-chain without user intervention:
1. Human approves at human-gate → calls `/continue`
2. If next step is agent → `'ready'` → immediately starts → `'running_code_agent'`
3. Agent completes → if next is human-gate → `'waiting_human'`
4. Chain breaks at human-gate steps for review

## Recommended Fixes

### Option 1: Fix Frontend Conditional (Defensive)

Add explicit handling for `status === 'ready'` with human-gate current step:

```typescript
// After line 356, before fallback
else if ((mission.status === 'ready' || mission.status === 'draft') && currentStep?.type === 'human-gate') {
  // Show editor for human-gate step even if status is 'ready'
  // This handles edge cases where status wasn't updated correctly
}
```

### Option 2: Ensure Backend Consistency

Verify that `getWorkflowById()` never returns undefined for valid workflow IDs. Add validation:

```typescript
const workflow = getWorkflowById(resolvedWorkflowId);
if (!workflow) {
  throw new Error(`Unknown workflow ID: ${resolvedWorkflowId}`);
}
```

### Option 3: UI Feedback for Inconsistent State

Show a warning when status and step type are inconsistent:

```typescript
const statusStepMismatch =
  (mission.status === 'ready' && currentStep?.type === 'human-gate') ||
  (mission.status === 'waiting_human' && currentStep?.type === 'agent');

if (statusStepMismatch) {
  console.warn('Mission status/step type mismatch detected');
}
```

## Open Questions

1. **Was this bug already fixed?** - The backend code appears correct. Was there a previous version where the initial status wasn't properly determined?

2. **Race condition window** - How long does the transient `'ready'` state last during step advancement? Could frontend polling catch this?

3. **Workflow lookup fallback** - Under what conditions would `getWorkflowById()` return undefined, triggering the default workflow fallback?

4. **Empty workflowId handling** - When frontend passes empty string `''` as workflowId, the backend correctly falls back to default. Is this the intended UX?

## Related Research

No prior research documents found on this topic.
