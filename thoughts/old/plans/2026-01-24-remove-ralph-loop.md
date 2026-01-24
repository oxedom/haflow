# Remove Ralph Loop Feature - Implementation Plan

## Overview

Remove the "Ralph Loop" autonomous workflow feature from the Haflow codebase. This feature auto-restarts the entire 8-step mission workflow until an agent produces a `<promise>COMPLETE</promise>` marker. The feature is being removed to simplify the mission execution model.

## Current State Analysis

The Ralph Loop is integrated across all three packages:

### Key Discoveries:
- Schema fields defined in `packages/shared/src/schemas.ts:51-53, 97-98`
- Loop logic lives in `packages/backend/src/services/mission-engine.ts:213-252`
- UI controls in `packages/frontend/src/components/NewMissionModal.tsx:121-149`
- CLI commands (`ralph_*.md`) are **separate tools** and will NOT be removed (they're named after the same article but serve different purposes)

## Desired End State

After this plan is complete:
- No ralph-related fields in Zod schemas
- No ralph loop logic in mission engine
- No ralph UI controls in frontend
- All tests pass
- Build succeeds for all packages
- Existing missions with ralph fields become no-ops (no migration needed)

## What We're NOT Doing

- **NOT removing** CLI commands (`.claude/commands/ralph_*.md`) - these are workflow automation tools unrelated to the loop feature
- **NOT migrating** existing mission.json files - ralph fields will be ignored
- **NOT adding** any replacement feature

## Implementation Approach

Remove ralph code in dependency order: shared → backend → frontend → tests. Build verification after each package.

---

## Phase 1: Remove Ralph from Shared Schemas

### Overview
Remove ralph-related fields from Zod schemas so downstream packages can't reference them.

### Changes Required:

#### 1. MissionMetaSchema
**File**: `packages/shared/src/schemas.ts`
**Lines**: 51-53
**Changes**: Remove these three fields from MissionMetaSchema:
```typescript
// REMOVE these lines:
ralph_mode: z.boolean().optional(),
ralph_max_iterations: z.number().min(1).max(20).optional(),
ralph_current_iteration: z.number().min(1).optional(),
```

#### 2. CreateMissionRequestSchema
**File**: `packages/shared/src/schemas.ts`
**Lines**: 97-98
**Changes**: Remove these two fields from CreateMissionRequestSchema:
```typescript
// REMOVE these lines:
ralphMode: z.boolean().optional(),
ralphMaxIterations: z.number().min(1).max(20).optional(),
```

### Success Criteria:

#### Automated Verification:
- [ ] Shared package builds: `pnpm --filter @haflow/shared build`
- [ ] No TypeScript errors in shared package

---

## Phase 2: Remove Ralph from Backend

### Overview
Remove ralph logic from services and routes. This is the core removal.

### Changes Required:

#### 1. Mission Engine - Constants
**File**: `packages/backend/src/services/mission-engine.ts`
**Lines**: 13-14
**Changes**: Remove `DEFAULT_RALPH_MAX_ITERATIONS` constant:
```typescript
// REMOVE:
const DEFAULT_RALPH_MAX_ITERATIONS = 5;
```

#### 2. Mission Engine - Loop Logic
**File**: `packages/backend/src/services/mission-engine.ts`
**Lines**: 213-252
**Changes**: Remove the entire ralph loop logic block from `handleAgentCompletion()`. This includes:
- Check for `<promise>COMPLETE</promise>` marker
- Iteration counter increment
- Workflow restart logic

#### 3. Mission Store - Interface
**File**: `packages/backend/src/services/mission-store.ts`
**Lines**: 22-26
**Changes**: Remove `RalphModeOptions` interface:
```typescript
// REMOVE entire interface:
interface RalphModeOptions {
  ralphMode?: boolean;
  ralphMaxIterations?: number;
}
```

#### 4. Mission Store - createMission Function
**File**: `packages/backend/src/services/mission-store.ts`
**Lines**: 30-52
**Changes**: Remove ralph field handling in `createMission()`:
- Remove `RalphModeOptions` from function parameters
- Remove ralph field assignments in mission object creation

#### 5. Missions Route
**File**: `packages/backend/src/routes/missions.ts`
**Lines**: 38-47
**Changes**: Remove `ralphMode` and `ralphMaxIterations` from request body destructuring and forwarding to createMission.

### Success Criteria:

#### Automated Verification:
- [ ] Backend builds: `pnpm --filter @haflow/backend build`
- [ ] No TypeScript errors referencing ralph fields

---

## Phase 3: Remove Ralph from Frontend

### Overview
Remove ralph UI controls and API parameters.

### Changes Required:

#### 1. NewMissionModal - UI Controls
**File**: `packages/frontend/src/components/NewMissionModal.tsx`
**Lines**: 121-149
**Changes**: Remove:
- Ralph mode checkbox
- Max iterations input field
- Associated state variables
- Form submission ralph params

#### 2. MissionDetail - Status Badge
**File**: `packages/frontend/src/components/MissionDetail.tsx`
**Lines**: 227-231
**Changes**: Remove ralph status badge display (shows current iteration).

#### 3. API Client
**File**: `packages/frontend/src/api/client.ts`
**Lines**: 26-42
**Changes**: Remove `ralphMode` and `ralphMaxIterations` from `createMission()` function parameters and request body.

### Success Criteria:

#### Automated Verification:
- [ ] Frontend builds: `pnpm --filter frontend build`
- [ ] Frontend lint passes: `pnpm --filter frontend lint`

---

## Phase 4: Update Tests

### Overview
Remove or update ralph-related test cases.

### Changes Required:

#### 1. Mission Store Tests
**File**: `packages/backend/tests/unit/services/mission-store.test.ts`
**Lines**: 195-252
**Changes**: Remove test cases for ralph mode creation and iteration tracking.

#### 2. Missions Route Tests
**File**: `packages/backend/tests/integration/routes/missions.test.ts`
**Lines**: 174-240
**Changes**: Remove ralph API integration tests.

#### 3. Mission Engine Tests
**File**: `packages/backend/tests/unit/services/mission-engine.test.ts`
**Changes**: Remove ralph loop completion tests (search for "ralph" to find all).

### Success Criteria:

#### Automated Verification:
- [ ] All tests pass: `pnpm --filter @haflow/backend test`

---

## Phase 5: Cleanup Documentation

### Overview
Remove obsolete design documents.

### Changes Required:

#### 1. Delete Obsolete Design Doc
**File**: `thoughts/ralph-loop-redesign-questions.md`
**Changes**: Delete file (no longer relevant).

#### 2. Delete Research Doc
**File**: `thoughts/ralph-loop-extraction-research.md`
**Changes**: Delete file (purpose complete).

### Success Criteria:

#### Automated Verification:
- [ ] Files deleted successfully

---

## Testing Strategy

### Unit Tests:
- Verify mission creation works without ralph fields
- Verify mission engine completes steps without ralph loop logic

### Integration Tests:
- Create mission via API (no ralph params)
- Complete workflow without loop restart behavior

### Manual Testing Steps:
1. Create a new mission via UI - no ralph checkbox should appear
2. Run through workflow - no loop restart should occur
3. View existing missions with ralph fields - should load without errors

## Migration Notes

**No migration required.** Existing missions with `ralph_mode`, `ralph_max_iterations`, and `ralph_current_iteration` fields in their `mission.json` will simply have those fields ignored. Zod's schema parsing will strip unknown fields.

## References

- Research document: `thoughts/ralph-loop-extraction-research.md`
- Original inspiration: "11 Tips For AI Coding With Ralph Wiggum" (AIHero.dev)
