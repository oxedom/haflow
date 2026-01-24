# Ralph Loop Redesign - Questions

> **Context:** Redesigning Ralph loop from mission-level to step-level toggle. Each agent step in the workflow can independently enable Ralph looping within its container.

---

## A. Scope & Architecture

### A1. Step-level configuration location
Where should Ralph be configured for each step?

- [ ] **Static in workflow definition** - Hardcoded in `workflow.ts` (e.g., implementation step always has Ralph enabled)
- [ ] **Runtime toggle** - User enables/disables Ralph when step is about to run
- [ ] **Mission creation** - Configure which steps get Ralph when creating mission
- [ ] **Other:** _______________

### A2. Default iterations per step
Should max iterations be the same for all steps or configurable per step?

- [ ] **Same for all** - Global default (e.g., 5 iterations)
- [ ] **Per-step defaults** - Different defaults by step type (cleanup: 2, implementation: 10)
- [ ] **User configurable** - Let user set iterations per step
- [ ] **Other:** _______________

### A3. Which steps should support Ralph?
Should all agent steps support Ralph loop, or only specific ones?

- [ ] **All agent steps** - cleanup, research, planning, implementation
- [ ] **Implementation only** - Only the final coding step
- [ ] **Configurable** - User chooses which steps get Ralph
- [ ] **Other:** _______________

---

## B. UI/UX Design

### B1. Where should step-level Ralph config appear?

- [ ] **Workflow timeline** - Click on step circle to configure
- [ ] **Step settings panel** - Separate panel when step is active
- [ ] **Pre-run modal** - Show options before starting an agent step
- [ ] **No runtime UI** - All config happens at mission creation
- [ ] **Other:** _______________

### B2. How should Ralph progress be displayed during execution?

- [ ] **Badge in header** - "Step 4 - Ralph 2/5"
- [ ] **Progress bar** - Visual fill in the step circle
- [ ] **Log output** - Show iteration count in the log viewer
- [ ] **Timeline annotation** - Small counter on the active step
- [ ] **Other:** _______________

### B3. What should users see after a Ralph step completes?

- [ ] **Just the final output** - Same as non-Ralph steps
- [ ] **Iteration summary** - "Completed in 3/5 iterations"
- [ ] **Full history** - Expandable log of each iteration's progress
- [ ] **Other:** _______________

---

## C. Backend Behavior

### C1. What triggers Ralph loop exit?

- [ ] **`<promise>COMPLETE</promise>` marker only** - As in ralph.sh
- [ ] **Max iterations reached** - Hard stop
- [ ] **Both** - Whichever comes first
- [ ] **Add failure detection** - Exit early on repeated errors
- [ ] **Other:** _______________

### C2. How should iteration state be stored?

- [ ] **In step run record** - `ralph_iteration: 3` in `r-<uuid>.json`
- [ ] **In mission metadata** - Current approach, but per-step
- [ ] **In a separate progress file** - Like `progress.txt` in ralph.sh
- [ ] **Other:** _______________

### C3. Should there be a `progress.txt` equivalent?

The ralph.sh pattern uses `progress.txt` to persist state between iterations. Should Haflow have this?

- [ ] **No** - Artifacts serve this purpose already
- [ ] **Yes, auto-generated** - System creates/updates progress file
- [ ] **Yes, agent-managed** - Agent writes to progress file like ralph.sh
- [ ] **Other:** _______________

---

## D. Migration & Cleanup

### D1. What happens to current mission-level Ralph fields?

Current fields: `ralph_mode`, `ralph_max_iterations`, `ralph_current_iteration`

- [ ] **Remove completely** - Breaking change, clean slate
- [ ] **Keep for backwards compatibility** - Support both mission and step level
- [ ] **Deprecate gracefully** - Keep reading old data, only write new format
- [ ] **Other:** _______________

### D2. Should existing missions with Ralph mode be migrated?

- [ ] **No** - They continue working as-is until completed
- [ ] **Yes** - Auto-migrate to new step-level format
- [ ] **Manual** - Provide migration script/command
- [ ] **Other:** _______________

---

## E. Advanced Features (Future)

### E1. Should users be able to pause/resume a Ralph loop?

- [ ] **No** - Keep it simple
- [ ] **Yes** - Pause after current iteration, resume later
- [ ] **Future consideration** - Not for initial redesign

### E2. Should there be HITL vs AFK mode distinction?

- [ ] **No** - All Ralph is autonomous (AFK)
- [ ] **Yes** - HITL runs 1 iteration and waits, AFK runs full loop
- [ ] **Future consideration**

### E3. Should Ralph support alternative loop types?

(e.g., test coverage loop, linting loop, entropy loop as mentioned in the article)

- [ ] **No** - Focus on task completion loop only
- [ ] **Yes** - Allow configuring loop type per step
- [ ] **Future consideration**

---

## F. Your Vision

### F1. What's the #1 goal of this redesign?
(Free text)

```
_______________________________________________
_______________________________________________
```

### F2. Any reference UI/apps that do this well?
(Free text)

```
_______________________________________________
_______________________________________________
```

### F3. Anything else I should know?
(Free text)

```
_______________________________________________
_______________________________________________
```

---

## References

- [11 Tips For AI Coding With Ralph Wiggum - AIHero](https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum)
- Current implementation: `packages/frontend/src/components/NewMissionModal.tsx` (lines 114-143)
- Current implementation: `packages/frontend/src/components/MissionDetail.tsx` (lines 227-231)
- Current implementation: `packages/backend/src/services/mission-engine.ts` (lines 213-252)
- Ralph script reference: `scripts/ralph.sh`
- Workflow definition: `packages/backend/src/services/workflow.ts`
