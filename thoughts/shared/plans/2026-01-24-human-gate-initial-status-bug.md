# Human-Gate Initial Status Bug Fix - Implementation Plan

## Overview

Fix the frontend conditional rendering gap in `MissionDetail.tsx` where a mission with `status === 'ready'` or `status === 'draft'` and a human-gate current step falls through to the generic fallback instead of showing the editor.

## Current State Analysis

**The Bug**: In `packages/frontend/src/components/MissionDetail.tsx:357-381`, the conditional chain only handles:
- `ready/draft + agent` → Shows "Start Agent" button
- But `ready/draft + human-gate` → Falls through to generic "Mission status: {status}" display

**Expected Behavior**: When the current step is a human-gate, the editor should be shown regardless of whether status is `'waiting_human'`, `'ready'`, or `'draft'`.

### Key Discoveries:
- Backend logic is correct (`mission-store.ts:49-51`) - properly sets `'waiting_human'` for human-gate first steps
- This is a defensive fix for edge cases (race conditions, corrupted state, workflow lookup fallbacks)
- The existing `waiting_human` editor branch at line 252 has the correct UI - we just need to also trigger it for `ready/draft + human-gate`

## Desired End State

When a mission has `currentStep.type === 'human-gate'`, the editor UI is displayed for any of these statuses:
- `'waiting_human'` (existing behavior)
- `'ready'` (new - defensive)
- `'draft'` (new - defensive)

**Verification**: Create a mission with the "Simple" workflow, manually edit `mission.json` to set `status: 'ready'`, reload the page - the editor should appear instead of "Mission status: ready".

## What We're NOT Doing

- NOT adding backend validation (Option 2 from research)
- NOT adding console.warn for mismatch detection (Option 3 from research)
- NOT changing the initial status logic in the backend (it's already correct)

## Implementation Approach

Modify the conditional chain in `MissionDetail.tsx` to combine the human-gate editor condition with status checks that include `'ready'` and `'draft'` in addition to `'waiting_human'`.

## Phase 1: Fix Frontend Conditional Rendering

### Overview
Modify the existing conditional logic to show the human-gate editor for all appropriate statuses.

### Changes Required:

#### 1. Update Conditional Logic in MissionDetail.tsx

**File**: `packages/frontend/src/components/MissionDetail.tsx`
**Lines**: 252 (the human-gate editor condition)

**Current code** (line 252):
```typescript
} : mission.status === 'waiting_human' && artifactName ? (
```

**New code**:
```typescript
} : (mission.status === 'waiting_human' ||
     ((mission.status === 'ready' || mission.status === 'draft') && currentStep?.type === 'human-gate')) && artifactName ? (
```

This change:
1. Keeps the existing `waiting_human` behavior
2. Adds: when `status` is `ready` or `draft` AND `currentStep.type` is `'human-gate'`, also show the editor
3. Still requires `artifactName` to be truthy

**Alternative (cleaner)**: Extract the condition to a variable for readability:

**Before line 238**, add:
```typescript
const shouldShowHumanGateEditor =
  artifactName && (
    mission.status === 'waiting_human' ||
    ((mission.status === 'ready' || mission.status === 'draft') && currentStep?.type === 'human-gate')
  );
```

Then change line 252 to:
```typescript
} : shouldShowHumanGateEditor ? (
```

And update the agent start condition (line 357) to ensure no overlap:
```typescript
} : (mission.status === 'ready' || mission.status === 'draft') && currentStep?.type === 'agent' ? (
```
(This line is actually already correct and excludes human-gate - no change needed.)

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm --filter frontend build`
- [x] Frontend lint passes: `pnpm --filter frontend lint` (pre-existing errors only, no new issues)
- [ ] Existing tests pass (if any frontend tests exist)

#### Manual Verification:
- [ ] Create a mission with "Simple" workflow → Editor appears immediately (status should be `waiting_human`)
- [ ] Create a mission with "Raw Research Plan Implement" workflow → "Start Agent" button appears (status should be `ready`)
- [ ] Edge case test: Manually edit a mission's `mission.json` to set `status: 'ready'` while on a human-gate step → Editor should appear instead of fallback

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before considering the fix complete.

---

## Testing Strategy

### Unit Tests:
No unit tests needed for this change - it's a simple conditional logic fix in JSX rendering.

### Integration Tests:
If Playwright E2E tests exist, they should cover:
- Creating a mission with Simple workflow shows editor
- Creating a mission with default workflow shows Start Agent button

### Manual Testing Steps:
1. Start backend: `pnpm --filter @haflow/backend dev`
2. Start frontend: `pnpm --filter frontend dev`
3. Create new mission with "Simple" workflow
4. Verify editor appears with raw-input.md content
5. Create new mission with "Raw Research Plan Implement" workflow
6. Verify "Start Agent" button appears

## Performance Considerations

None - this is a trivial conditional logic change with no performance impact.

## Migration Notes

None - this is a frontend-only fix with no data changes.

## References

- Research document: `thoughts/shared/research/2026-01-24-human-gate-initial-status-bug.md`
- Frontend component: `packages/frontend/src/components/MissionDetail.tsx:238-381`
- Backend initial status: `packages/backend/src/services/mission-store.ts:46-51`
- Workflow definitions: `packages/backend/src/services/workflow.ts:4-28`
