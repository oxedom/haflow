---
date: 2026-01-24T12:00:00-08:00
researcher: Claude
git_commit: 573d259b5ecfdd27fac1e7bc9a9cf3b60b513f43
branch: main
repository: haflow
topic: "Workflow History Navigation Feature Research"
tags: [research, codebase, workflow, frontend, mission-detail, history, navigation]
status: complete
last_updated: 2026-01-24
last_updated_by: Claude
---

# Research: Workflow History Navigation Feature

**Date**: 2026-01-24T12:00:00-08:00
**Researcher**: Claude
**Git Commit**: 573d259b5ecfdd27fac1e7bc9a9cf3b60b513f43
**Branch**: main
**Repository**: haflow

## Research Question

How can we implement the ability to toggle through completed workflow steps and view their inputs/outputs in read-only mode?

## Summary

The current architecture already stores all data needed for workflow history navigation:
- **Backend**: Complete step execution history in `runs/` directory, all artifacts in `artifacts/` directory
- **API**: `GET /api/missions/:id` returns full workflow, all runs, and all artifacts in single response
- **Frontend**: Currently only displays current step; needs UI additions for step navigation and historical artifact viewing

**Key finding**: This is primarily a frontend feature. The backend already provides all necessary data - no new API endpoints required for basic implementation.

## Detailed Findings

### Backend: Workflow State & Step Tracking

#### Storage Structure
Each mission maintains complete execution history:
```
~/.haflow/missions/m-<uuid>/
├── mission.json          # MissionMeta with current_step pointer
├── artifacts/            # All workflow artifacts
│   ├── raw-input.md
│   ├── structured-text.md
│   └── ...
├── runs/                 # StepRun records for each execution
│   └── r-<uuid>.json
└── logs/                 # Container output per run
    └── r-<uuid>.log
```

#### StepRun Schema (`packages/shared/src/schemas.ts:53-60`)
```typescript
{
  step_id: string,           // Links to WorkflowStep.step_id
  run_id: string,            // e.g., 'r-xyz98765'
  started_at: string,        // ISO timestamp
  finished_at?: string,      // ISO timestamp when complete
  exit_code?: number,        // Container exit code (0 = success)
  container_id?: string      // Docker container ID
}
```

#### Step History Retrieval (`packages/backend/src/services/mission-store.ts:179-196`)
The `loadRuns()` function:
- Reads all `.json` files from `runs/` directory
- Sorts by `started_at` ascending (chronological order)
- Returns complete array of all step executions

### Artifact Storage & Retrieval

#### Artifact Mapping by Step
Each workflow step defines its artifacts in the workflow definition (`packages/backend/src/services/workflow.ts`):

| Step | Type | Input | Output | Review |
|------|------|-------|--------|--------|
| cleanup | agent | `raw-input.md` | `structured-text.md` | - |
| review-structured | human-gate | - | - | `structured-text.md` |
| research | agent | `structured-text.md` | `research-output.md` | - |
| review-research | human-gate | - | - | `research-output.md` |
| planning | agent | `research-output.md` | `implementation-plan.md` | - |
| review-plan | human-gate | - | - | `implementation-plan.md` |
| implementation | agent | `implementation-plan.md` | `implementation-result.json` | - |
| review-impl | human-gate | - | - | `implementation-result.json` |

#### API Data Structure (`MissionDetail`)
All artifacts returned in single response:
```typescript
{
  workflow: Workflow,                    // Full step definitions
  artifacts: Record<string, string>,     // filename -> content map
  runs: StepRun[],                       // Complete execution history
  current_step: number,                  // Current position
  current_log_tail?: string              // Live log (current run only)
}
```

### Frontend: Current Architecture

#### MissionDetail Component (`packages/frontend/src/components/MissionDetail.tsx`)

**Current Layout**:
1. Header with mission title + status badge (lines 227-236)
2. WorkflowTimeline - horizontal step progress (lines 239-241)
3. Main content - status-driven conditional rendering (lines 244-389)
4. ActivityHistory - collapsible run history at bottom (lines 391-393)

**WorkflowTimeline** (lines 30-76):
- Displays all steps as connected circles
- Visual indicators: completed (checkmark), current (highlighted), future (muted)
- **Display only** - no click handlers or navigation

**Conditional Content Rendering** (based on `mission.status`):
- `running_code_agent`/`running_root_llm`: Log viewer only
- `waiting_human`: Editor with artifact content, save/continue buttons
- `failed`: Error display with mark-completed option
- `ready`/`draft` + agent step: Start button
- Other: Simple status display

**Key Current Step Logic** (lines 195-199):
```typescript
const currentStep = mission.workflow.steps[mission.current_step]
const artifactName = currentStep?.type === 'human-gate'
  ? currentStep.reviewArtifact
  : currentStep?.outputArtifact
const artifactContent = artifactName ? mission.artifacts[artifactName] : null
```

**ActivityHistory Component** (lines 78-116):
- Collapsible list of all runs
- Shows step_id, run_id, exit code status, timestamp
- **No artifact viewing** - just metadata display

### API Contract Analysis

#### Endpoint: `GET /api/missions/:missionId`
Returns full `MissionDetail` with:
- `workflow.steps` - All step definitions with artifact mappings
- `runs` - All step executions sorted chronologically
- `artifacts` - All artifact contents as key-value map
- `current_step` - Current workflow position

**Data Already Available**:
- Step-to-artifact mapping via `workflow.steps[i].inputArtifact`/`outputArtifact`
- Execution timestamps via `runs[].started_at`/`finished_at`
- All artifact contents via `artifacts[filename]`

**Missing (but not critical for v1)**:
- Full log retrieval for historical runs (only `current_log_tail` for active run)
- Currently would need: `GET /api/missions/:id/runs/:runId/log`

## Architecture Insights

### Key Pattern: All Data in Single Response
The current design loads everything upfront:
- All artifacts in memory
- All runs in memory
- No pagination

**Implication**: History navigation can be implemented entirely client-side by:
1. Making timeline steps clickable
2. Adding a "selected step" state (distinct from `current_step`)
3. Looking up artifacts by step's `inputArtifact`/`outputArtifact` fields
4. Rendering in read-only mode when viewing historical steps

### Implementation Approach Options

#### Option A: In-Place Step Selection
1. Add `selectedStepIndex` state to MissionDetail component
2. Make WorkflowTimeline circles clickable for completed steps
3. When `selectedStepIndex !== current_step`, show read-only artifact viewer
4. Add "Return to Current" button when viewing history

**Pros**: Minimal changes, uses existing layout
**Cons**: Limited space for showing both input and output

#### Option B: Step Detail Modal/Drawer
1. Add click handler to completed steps in timeline
2. Open modal/drawer showing step details:
   - Step name and execution info
   - Input artifact (read-only)
   - Output artifact (read-only)
   - Run status and timestamps
3. Keep main view always on current step

**Pros**: Clear separation, can show both input/output
**Cons**: Additional UI component needed

#### Option C: Split View History Mode
1. Add "View History" toggle button
2. When enabled, split view shows:
   - Left: Step list/timeline
   - Right: Selected step's artifacts
3. Can toggle between input/output artifacts

**Pros**: Best for detailed exploration
**Cons**: Significant layout changes

## Code References

### Backend
- `packages/backend/src/services/mission-store.ts:179-196` - `loadRuns()` returns sorted step history
- `packages/backend/src/services/mission-store.ts:149-162` - `loadArtifacts()` returns all artifacts
- `packages/backend/src/services/mission-store.ts:88-104` - `getDetail()` assembles MissionDetail
- `packages/backend/src/services/workflow.ts:4-28` - Workflow step definitions with artifact mappings

### Frontend
- `packages/frontend/src/components/MissionDetail.tsx:30-76` - WorkflowTimeline (display only)
- `packages/frontend/src/components/MissionDetail.tsx:78-116` - ActivityHistory component
- `packages/frontend/src/components/MissionDetail.tsx:195-199` - Current step artifact resolution
- `packages/frontend/src/components/MissionDetail.tsx:245-388` - Status-driven content rendering

### Shared Types
- `packages/shared/src/schemas.ts:21-29` - WorkflowStepSchema with artifact fields
- `packages/shared/src/schemas.ts:53-60` - StepRunSchema for execution history
- `packages/shared/src/schemas.ts:81-86` - MissionDetailSchema

## Historical Context (from thoughts/)

- `thoughts/shared/draft/buttons.md` - Original feature request document
- `thoughts/ralph-loop-redesign-questions.md` - UI/UX design questions for step-level progress display
- `thoughts/haloop-v0-working-spec.md` - v0 working specification (may contain original vision)

## Open Questions

1. **View Mode**: Should historical steps show input, output, or both artifacts?
2. **Log Access**: Should users be able to view complete logs for historical runs? (Would require new API endpoint)
3. **Edit vs View**: Can users ever edit historical artifacts, or strictly read-only?
4. **Current Step Indicator**: How to clearly distinguish "viewing history" from "at current step"?
5. **Mobile/Responsive**: How should history navigation work on smaller screens?
6. **Diff View**: Should we show before/after diff between step input and output?

## Recommended Next Steps

1. **Frontend-only v1**: Implement Option A (in-place step selection) as it requires no backend changes
2. **Add log endpoint** if full log viewing is needed: `GET /api/missions/:id/runs/:runId/log`
3. **Consider step-aware ActivityHistory**: Merge step navigation into existing ActivityHistory component
4. **Test IDs**: Add `data-testid` attributes for E2E testing of new navigation elements
