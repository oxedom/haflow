# Ralph Loop Feature - Extraction Research

## Overview

The "ralph loop" is an autonomous workflow feature that auto-restarts the entire mission workflow until the agent produces a `<promise>COMPLETE</promise>` marker. Named after the article "11 Tips For AI Coding With Ralph Wiggum" (AIHero.dev).

## Two Distinct Ralph Concepts

### 1. Ralph Loop (Mission Feature) - Main Target for Removal

Core mechanic: When an agent step completes without the COMPLETE marker, the entire 8-step workflow restarts from step 0. This repeats until:
- Agent outputs `<promise>COMPLETE</promise>`, OR
- Max iterations reached (default 5, configurable 1-20)

### 2. Ralph CLI Commands - Separate Concern

CLI orchestration tools (`.claude/commands/ralph_*.md`) that are independent from the mission loop feature. These may or may not need removal depending on your goals.

---

## Files to Modify for Removal

### Shared Package

| File | Lines | What to Remove |
|------|-------|----------------|
| `packages/shared/src/schemas.ts` | 51-53 | `ralph_mode`, `ralph_max_iterations`, `ralph_current_iteration` in MissionMetaSchema |
| `packages/shared/src/schemas.ts` | 97-98 | `ralphMode`, `ralphMaxIterations` in CreateMissionRequestSchema |

### Backend

| File | Lines | What to Remove |
|------|-------|----------------|
| `packages/backend/src/services/mission-engine.ts` | 13-14 | `DEFAULT_RALPH_MAX_ITERATIONS` constant |
| `packages/backend/src/services/mission-engine.ts` | 213-252 | Ralph loop logic in `handleAgentCompletion()` |
| `packages/backend/src/services/mission-store.ts` | 22-26 | `RalphModeOptions` interface |
| `packages/backend/src/services/mission-store.ts` | 30-52 | Ralph field handling in `createMission()` |
| `packages/backend/src/routes/missions.ts` | 38-47 | `ralphMode`/`ralphMaxIterations` request params |

### Frontend

| File | Lines | What to Remove |
|------|-------|----------------|
| `packages/frontend/src/components/NewMissionModal.tsx` | 121-149 | Checkbox + max iterations input UI |
| `packages/frontend/src/components/MissionDetail.tsx` | 227-231 | Ralph status badge display |
| `packages/frontend/src/api/client.ts` | 26-42 | Ralph params in `createMission()` |

### Tests

| File | Lines | What to Remove |
|------|-------|----------------|
| `packages/backend/tests/unit/services/mission-store.test.ts` | 195-252 | Ralph-related test cases |
| `packages/backend/tests/integration/routes/missions.test.ts` | 174-240 | Ralph API tests |
| `packages/backend/tests/unit/services/mission-engine.test.ts` | Various | Ralph loop completion tests |

### CLI Commands (Optional - Separate Feature)

| File | Purpose |
|------|---------|
| `.claude/commands/ralph_plan.md` | Create implementation plan for ticket |
| `.claude/commands/ralph_research.md` | Research priority ticket |
| `.claude/commands/ralph_impl.md` | Implement with worktree setup |
| `.claude/commands/oneshot.md` | Chains ralph_research → planning |
| `.claude/commands/oneshot_plan.md` | Chains ralph_plan → ralph_impl |

### Design Docs

| File | Action |
|------|--------|
| `thoughts/ralph-loop-redesign-questions.md` | Delete (obsolete if removing feature) |

---

## How Ralph Loop Works (Technical Detail)

### Flow

1. **Mission Creation**
   - User enables "Run as Ralph loop" checkbox in NewMissionModal
   - Sets max iterations (1-20, default 5)
   - POST `/api/missions` with `ralphMode: true, ralphMaxIterations: N`

2. **Storage**
   - `mission-store.ts` saves `ralph_mode`, `ralph_max_iterations`, `ralph_current_iteration: 1`

3. **Execution**
   - Mission runs standard 8-step workflow
   - After each agent step, `handleAgentCompletion()` checks output

4. **Loop Decision** (in `mission-engine.ts`)
   ```
   if (ralph_mode && !output.includes('<promise>COMPLETE</promise>')) {
     if (ralph_current_iteration < ralph_max_iterations) {
       // Restart workflow from step 0
       updateMeta({ current_step: 0 })
       ralph_current_iteration++
       startAgentStep() // auto-start first step
     }
   }
   ```

5. **Exit Conditions**
   - Agent outputs `<promise>COMPLETE</promise>` → advance normally
   - Max iterations reached → exit loop, advance anyway

### Workflow Steps (for context)

| Step | Type | Name |
|------|------|------|
| 0 | Agent | Cleanup (raw-input.md → structured-text.md) |
| 1 | Human | Review structured |
| 2 | Agent | Research |
| 3 | Human | Review research |
| 4 | Agent | Planning |
| 5 | Human | Review plan |
| 6 | Agent | Implementation |
| 7 | Human | Review implementation |

---

## Removal Strategy

### Order of Operations

1. **Shared schemas first** - Remove ralph fields from Zod schemas
2. **Build shared** - `pnpm --filter @haflow/shared build`
3. **Backend** - Remove ralph logic from services and routes
4. **Frontend** - Remove UI components and API params
5. **Tests** - Remove or update ralph-related tests
6. **CLI commands** - Decide whether to keep/remove/rename

### Migration Consideration

Existing missions in `~/.haflow/missions/` may have ralph fields in their `mission.json`. Options:
- Ignore (fields become no-ops)
- Add migration script to clean up
- Document manual cleanup

### Build Verification

After removal:
```bash
pnpm --filter @haflow/shared build
pnpm --filter @haflow/backend build
pnpm --filter frontend build
pnpm --filter @haflow/backend test
```
