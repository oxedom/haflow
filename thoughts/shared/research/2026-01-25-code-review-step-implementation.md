---
date: 2026-01-25T12:00:00-08:00
researcher: Claude
git_commit: 827e66d025945f24264d460d891eb93042e71464
branch: main
repository: oxedom/haflow
topic: "Code Review Step Implementation Research"
tags: [research, codebase, code-review, step-types, mission-engine, frontend]
status: complete
last_updated: 2026-01-25
last_updated_by: Claude
---

# Research: Code Review Step Implementation

**Date**: 2026-01-25T12:00:00-08:00
**Researcher**: Claude
**Git Commit**: 827e66d025945f24264d460d891eb93042e71464
**Branch**: main
**Repository**: oxedom/haflow

## Research Question

What existing patterns and implementations exist in the codebase to support adding a new `code-review` step type that allows users to review code changes, run CLI commands, and provide feedback after code-generation steps?

## Summary

The codebase has strong foundations for implementing code-review:

1. **Step type system is extensible** - Adding `'code-review'` to `StepTypeSchema` requires minimal changes
2. **Git operations already exist** - `git-status` and `git-diff` endpoints are implemented
3. **Command execution infrastructure exists** - Docker-based execution with spawn/exec patterns
4. **Frontend step rendering is type-driven** - Adding new step type requires new component + routing logic
5. **Key gap: No streaming output to frontend** - Currently uses polling, not WebSocket/SSE

## Detailed Findings

### 1. Step Type System

#### Schema Definition (`packages/shared/src/schemas.ts:18`)
```typescript
export const StepTypeSchema = z.enum(['llm', 'agent', 'human-gate']);
```

**To add code-review**: Simply extend the enum:
```typescript
export const StepTypeSchema = z.enum(['llm', 'agent', 'human-gate', 'code-review']);
```

#### WorkflowStep Properties (`packages/shared/src/schemas.ts:24-33`)
Current properties support code-review needs:
- `step_id`, `name`, `type` - Standard identification
- `workspaceMode: 'codegen'` - Already handles project cloning
- `reviewArtifact` - Could be repurposed or new property added

**Potential additions for code-review**:
```typescript
quickCommands?: string[];  // e.g., ['npm test', 'npm run lint']
timeout?: number;          // Command execution timeout
```

### 2. Mission Engine Step Processing

#### Entry Point (`packages/backend/src/services/mission-engine.ts:24-44`)
```typescript
if (currentStep.type === 'human-gate') {
  await advanceToNextStep(missionId, meta);
} else if (currentStep.type === 'agent') {
  await startAgentStep(missionId, meta, currentStep);
}
```

**To add code-review**: Add new branch:
```typescript
else if (currentStep.type === 'code-review') {
  // Set status to waiting, similar to human-gate
  await missionStore.updateMeta(missionId, { status: 'waiting_human' });
}
```

#### Status Values (`packages/shared/src/schemas.ts:7-15`)
Current statuses:
- `'waiting_human'` - Paused at human gate (reusable for code-review)
- `'running_code_agent'` - Agent executing

**Decision**: Reuse `'waiting_human'` or add `'reviewing_code'`? Reuse is simpler.

### 3. Git Operations API (Already Implemented)

#### GET /missions/:id/git-status (`packages/backend/src/routes/missions.ts:122-137`)
- Returns `{ hasChanges, files: [{status, path}], summary }`
- Uses `git status --porcelain` and `git diff --stat HEAD`
- Works with cloned project at `~/.haflow/missions/{id}/project/`

#### GET /missions/:id/git-diff/:filePath (`packages/backend/src/routes/missions.ts:139-160`)
- Returns `{ diff: string }` for specific file
- Uses `git diff HEAD -- "${filePath}"`

**Gaps**:
- No full diff endpoint (all files at once)
- No streaming for large diffs

#### Implementation (`packages/backend/src/utils/config.ts:136-192`)
- `getFileDiff(clonePath, filePath)` - Single file diff
- `getProjectGitStatus(missionId)` - Status with file list
- All use `execAsync(git ...)` pattern

### 4. Command Execution Infrastructure

#### Current Approach: Docker Containers (`packages/backend/src/services/docker.ts`)

**For agent steps**, commands run inside Docker:
```typescript
// docker.ts:28-115
provider.start({
  image: 'node:20-slim',
  command: ['sh', '-c', 'npm test'],
  workspacePath: '/path/to/cloned/project',
  // ...
})
```

**For code-review**, we have two options:

**Option A: Run in Docker** (safer, consistent)
- Reuse existing `provider.start()` pattern
- Volume mount the cloned project
- Capture output via `docker logs`

**Option B: Run directly on host** (simpler, faster)
- New utility using `spawn` directly
- Working directory: `~/.haflow/missions/{id}/project/`
- More security considerations

**Recommendation**: Option A for consistency with existing patterns.

#### Streaming Output Pattern (`packages/backend/src/services/docker.ts:281-463`)
Claude streaming uses:
```typescript
const proc = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
const rl = readline.createInterface({ input: proc.stdout });
for await (const line of rl) { /* parse */ }
```

This pattern can be adapted for arbitrary command streaming.

### 5. Frontend Step Rendering

#### Step Type Routing (`packages/frontend/src/components/MissionDetail.tsx:224-235`)
```typescript
const currentStep = mission.workflow.steps[mission.current_step];
const shouldShowHumanGateEditor =
  artifactName && (
    mission.status === 'waiting_human' ||
    ((mission.status === 'ready' || mission.status === 'draft') && currentStep?.type === 'human-gate')
  );
```

**To add code-review**: Add similar condition and component:
```typescript
const shouldShowCodeReview =
  mission.status === 'waiting_human' &&
  currentStep?.type === 'code-review';

// In render:
{shouldShowCodeReview && <CodeReviewStep mission={mission} onContinue={...} />}
```

#### Polling for Updates (`packages/frontend/src/App.tsx:49-55`)
```typescript
refetchInterval: (query) => {
  const mission = query.state.data;
  if (mission?.status === 'running_code_agent') return 500;
  return 2000;
}
```

**For command streaming**: Would need faster polling or switch to WebSocket/SSE.

### 6. Key Patterns to Follow

#### API Response Pattern (`packages/backend/src/utils/response.ts`)
All responses use `sendSuccess(res, data)` wrapper.

#### Route Pattern (`packages/backend/src/routes/missions.ts`)
```typescript
router.post('/:missionId/run-command', async (req, res) => {
  const { missionId } = req.params;
  const { command } = req.body;
  // Validate mission exists
  // Execute command
  // Return output
});
```

#### Frontend API Client (`packages/frontend/src/api/client.ts`)
```typescript
export const api = {
  runCommand: async (missionId: string, command: string) => {
    const response = await client.post(`/missions/${missionId}/run-command`, { command });
    return response.data;
  }
};
```

## Code References

### Backend
- `packages/backend/src/services/mission-engine.ts:24-44` - Step type routing
- `packages/backend/src/services/mission-engine.ts:76-115` - Agent step execution
- `packages/backend/src/routes/missions.ts:122-160` - Git endpoints
- `packages/backend/src/utils/config.ts:136-192` - Git utilities
- `packages/backend/src/services/docker.ts:281-463` - Streaming execution

### Shared
- `packages/shared/src/schemas.ts:18` - StepTypeSchema
- `packages/shared/src/schemas.ts:24-33` - WorkflowStepSchema
- `packages/shared/src/schemas.ts:7-15` - MissionStatusSchema

### Frontend
- `packages/frontend/src/components/MissionDetail.tsx:224-235` - Step type detection
- `packages/frontend/src/components/MissionDetail.tsx:292-374` - Human-gate editor
- `packages/frontend/src/App.tsx:49-55` - Polling configuration
- `packages/frontend/src/api/client.ts` - API client

## Architecture Insights

### 1. Separation of Concerns
- **Shared package**: Type definitions only
- **Backend**: Execution + persistence
- **Frontend**: Display + user interaction

### 2. Polling vs Streaming
Current architecture uses polling (TanStack Query) not real-time streaming. For command output:
- **Option 1**: Fast polling (500ms) - Simple, works today
- **Option 2**: Server-Sent Events (SSE) - Better UX, more work
- **Option 3**: WebSocket - Overkill for this use case

### 3. Step Execution Model
- **Agent steps**: Fire-and-forget, background execution
- **Human-gate steps**: Instant, no execution, just UI pause
- **Code-review steps**: Interactive pause with command capabilities

### 4. File System Layout
Cloned projects live at: `~/.haflow/missions/{missionId}/project/`
This is already bind-mounted for `codegen` workspace mode.

## Implementation Recommendations

### Phase 1: Minimal Backend
1. Add `'code-review'` to `StepTypeSchema`
2. Add endpoint: `POST /missions/:id/run-command`
3. Add endpoint: `GET /missions/:id/git-diff` (full diff)
4. Handle code-review step in mission engine (wait like human-gate)

### Phase 2: Minimal Frontend
1. Create `CodeReviewStep` component
2. Display git status (call existing endpoint)
3. Display diffs (add diff viewer component)
4. Command input + output display (polling-based)
5. Continue/Request Changes buttons

### Phase 3: Enhanced UX
1. Add SSE endpoint for streaming command output
2. Quick command buttons (configurable)
3. Better diff viewer with syntax highlighting

### Security Considerations
1. **Command validation**: Consider allowlist for dangerous commands
2. **Timeout**: Add configurable timeout (default 60s)
3. **Output limits**: Truncate large output
4. **Working directory**: Ensure commands can't escape mission directory

## Open Questions

1. **Streaming strategy**: Polling vs SSE vs WebSocket?
   - Recommendation: Start with polling, add SSE later

2. **Request Changes flow**: Return to which step?
   - Recommendation: Return to most recent codegen step with feedback

3. **Feedback storage**: New artifact or append to plan?
   - Recommendation: New artifact `feedback-{iteration}.md`

4. **Security model**: Allowlist commands or trust user?
   - Recommendation: Trust user (local-first tool), add timeout

## Related Research

- No existing research documents found for code-review feature

---

## Appendix: New Files to Create

### Backend
- `packages/backend/src/routes/command.ts` - Command execution routes (or add to missions.ts)

### Frontend
- `packages/frontend/src/components/CodeReviewStep.tsx` - Main component
- `packages/frontend/src/components/DiffViewer.tsx` - Diff display with syntax highlighting
- `packages/frontend/src/components/CommandRunner.tsx` - Command input + output

### Shared
- Update `packages/shared/src/schemas.ts` - Add code-review type and related schemas
