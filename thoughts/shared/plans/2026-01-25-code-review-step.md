# Code Review Step Implementation Plan

## Overview

Add a new step type `code-review` that follows code-generation steps. This step provides a read-only UI for reviewing changes made by Claude in the cloned project, with git status/diff viewing and the ability to run CLI commands for verification (tests, lint, build).

**Key Constraint**: This is a **read-only review** step. Users can view changes and run verification commands, but cannot edit code or request revisions. The only actions are "Approve & Continue" or "Abort Mission".

## Current State Analysis

### Existing Step Types (`packages/shared/src/schemas.ts:18`)
- `'llm'` - Not implemented
- `'agent'` - Docker sandbox execution
- `'human-gate'` - Simple artifact review/edit

### Existing Git APIs (`packages/backend/src/routes/missions.ts:122-160`)
- `GET /missions/:id/git-status` - Returns porcelain status + diff stat
- `GET /missions/:id/git-diff/:filePath(*)` - Returns diff for specific file

### Current Workflow Structure (`packages/backend/src/services/workflow.ts:15-16`)
```typescript
{ step_id: 'implementation', type: 'agent', workspaceMode: 'codegen', ... },
{ step_id: 'review-impl', type: 'human-gate', reviewArtifact: 'implementation-result.json', ... }
```

The `review-impl` step is a simple human-gate that shows the JSON result. We'll replace this with a `code-review` step that shows the actual code changes.

## Desired End State

A new step type `code-review` that:
1. Displays git status with list of changed files
2. Has "View Diff" functionality per file (or full diff view)
3. Has command input to run CLI commands in the cloned project
4. Shows command output (polled via REST)
5. Has "Approve & Continue" button to proceed
6. Has optional "Abort Mission" if user decides not to proceed

### UI Flow
```
[Agent completes implementation]
     ↓
[Mission status: 'waiting_code_review']
     ↓
[Frontend shows CodeReviewStep component]
     ↓
[User views git status, diffs, runs npm test, etc.]
     ↓
[User clicks "Approve & Continue"]
     ↓
[Mission advances to next step or completes]
```

## What We're NOT Doing

- No code editing in the review UI
- No "Request Changes" / revision flow
- No WebSocket/SSE streaming (use REST polling)
- No inline diff editing
- No cherry-picking changes
- No syntax highlighting for all languages (basic for now)
- No side-by-side diff view (unified diff only)

## Implementation Approach

1. **Schema changes** - Add `'code-review'` step type and `'waiting_code_review'` status
2. **Backend API** - Add command execution endpoint with polling
3. **Mission engine** - Handle `code-review` step type transitions
4. **Workflow config** - Update workflows to use `code-review` after codegen
5. **Frontend** - Create `CodeReviewStep` component

---

## Phase 1: Schema and Type Updates

### Overview
Add the new step type and mission status to the shared schema package.

### Changes Required:

#### 1. Shared Schemas
**File**: `packages/shared/src/schemas.ts`

Add `'code-review'` to `StepTypeSchema`:
```typescript
// Line 18
export const StepTypeSchema = z.enum(['llm', 'agent', 'human-gate', 'code-review']);
```

Add `'waiting_code_review'` to `MissionStatusSchema`:
```typescript
// Lines 7-15
export const MissionStatusSchema = z.enum([
  'draft',
  'ready',
  'waiting_human',
  'waiting_code_review',   // NEW
  'running_code_agent',
  'running_root_llm',
  'failed',
  'completed',
]);
```

Add optional `quickCommands` field to `WorkflowStepSchema` for code-review steps:
```typescript
// Lines 24-33
export const WorkflowStepSchema = z.object({
  step_id: z.string(),
  name: z.string(),
  type: StepTypeSchema,
  agent: z.string().optional(),
  inputArtifact: z.string().optional(),
  outputArtifact: z.string().optional(),
  reviewArtifact: z.string().optional(),
  workspaceMode: WorkspaceModeSchema,
  quickCommands: z.array(z.string()).optional(),  // NEW: for code-review steps
});
```

### Success Criteria:

#### Automated Verification:
- [ ] Shared package builds successfully: `pnpm --filter @haflow/shared build`
- [ ] Backend builds successfully: `pnpm --filter @haflow/backend build`
- [ ] Frontend builds successfully: `pnpm --filter frontend build`
- [ ] All existing tests pass: `pnpm --filter @haflow/backend test`

#### Manual Verification:
- [ ] Type intellisense works correctly in IDE

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 2: Backend Command Execution API

### Overview
Add an endpoint to execute CLI commands in the cloned project directory, with a polling mechanism for output.

### Changes Required:

#### 1. Command Execution Service
**File**: `packages/backend/src/services/command-runner.ts` (NEW)

```typescript
import { exec } from 'child_process';
import { join } from 'path';
import { config } from '../utils/config.js';
import { randomUUID } from 'crypto';

interface CommandExecution {
  id: string;
  command: string;
  status: 'running' | 'completed' | 'failed';
  output: string;
  exitCode?: number;
  startedAt: string;
  finishedAt?: string;
}

// In-memory store for command executions (keyed by execution ID)
const executions = new Map<string, CommandExecution>();

// Cleanup old executions after 5 minutes
const EXECUTION_TTL = 5 * 60 * 1000;

export async function executeCommand(
  missionId: string,
  command: string,
  timeoutMs: number = 60000
): Promise<string> {
  const projectPath = join(config.missionsDir, missionId, 'project');
  const executionId = `exec-${randomUUID().slice(0, 8)}`;

  const execution: CommandExecution = {
    id: executionId,
    command,
    status: 'running',
    output: '',
    startedAt: new Date().toISOString(),
  };

  executions.set(executionId, execution);

  // Clean up old executions
  cleanupOldExecutions();

  // Run command asynchronously
  runCommand(executionId, command, projectPath, timeoutMs);

  return executionId;
}

function runCommand(
  executionId: string,
  command: string,
  cwd: string,
  timeoutMs: number
): void {
  const execution = executions.get(executionId);
  if (!execution) return;

  const child = exec(command, {
    cwd,
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024, // 10MB
  });

  child.stdout?.on('data', (data) => {
    execution.output += data;
  });

  child.stderr?.on('data', (data) => {
    execution.output += data;
  });

  child.on('close', (code) => {
    execution.status = code === 0 ? 'completed' : 'failed';
    execution.exitCode = code ?? 1;
    execution.finishedAt = new Date().toISOString();
  });

  child.on('error', (err) => {
    execution.status = 'failed';
    execution.output += `\nError: ${err.message}`;
    execution.exitCode = 1;
    execution.finishedAt = new Date().toISOString();
  });
}

export function getExecution(executionId: string): CommandExecution | undefined {
  return executions.get(executionId);
}

function cleanupOldExecutions(): void {
  const now = Date.now();
  for (const [id, exec] of executions) {
    if (exec.finishedAt) {
      const finishedTime = new Date(exec.finishedAt).getTime();
      if (now - finishedTime > EXECUTION_TTL) {
        executions.delete(id);
      }
    }
  }
}
```

#### 2. API Routes
**File**: `packages/backend/src/routes/missions.ts`

Add imports at top:
```typescript
import { executeCommand, getExecution } from '../services/command-runner.js';
```

Add new endpoints after existing git-diff endpoint (around line 161):

```typescript
// Execute a command in the mission's cloned project
missionRoutes.post('/:missionId/run-command', async (req, res, next) => {
  try {
    const missionId = req.params.missionId as string;
    const { command, timeout } = req.body as { command: string; timeout?: number };

    const meta = await missionStore.getMeta(missionId);
    if (!meta) {
      return sendError(res, `Mission not found: ${missionId}`, 404);
    }

    if (!command || typeof command !== 'string') {
      return sendError(res, 'Command is required', 400);
    }

    // Check if project clone exists
    const projectPath = join(config.missionsDir, missionId, 'project');
    if (!existsSync(projectPath)) {
      return sendError(res, 'No project clone exists for this mission', 400);
    }

    const executionId = await executeCommand(missionId, command, timeout);
    sendSuccess(res, { executionId });
  } catch (err) {
    next(err);
  }
});

// Get command execution status/output
missionRoutes.get('/:missionId/execution/:executionId', async (req, res, next) => {
  try {
    const { missionId, executionId } = req.params;

    const meta = await missionStore.getMeta(missionId);
    if (!meta) {
      return sendError(res, `Mission not found: ${missionId}`, 404);
    }

    const execution = getExecution(executionId);
    if (!execution) {
      return sendError(res, `Execution not found: ${executionId}`, 404);
    }

    sendSuccess(res, execution);
  } catch (err) {
    next(err);
  }
});

// Get full diff for all changed files
missionRoutes.get('/:missionId/git-diff', async (req, res, next) => {
  try {
    const missionId = req.params.missionId as string;

    const meta = await missionStore.getMeta(missionId);
    if (!meta) {
      return sendError(res, `Mission not found: ${missionId}`, 404);
    }

    const clonePath = join(config.missionsDir, missionId, 'project');
    if (!existsSync(clonePath)) {
      return sendSuccess(res, { diff: '' });
    }

    const { stdout } = await execAsync('git diff HEAD', { cwd: clonePath });
    sendSuccess(res, { diff: stdout });
  } catch (err) {
    next(err);
  }
});
```

Add necessary imports at the top of the file:
```typescript
import { existsSync } from 'fs';
import { execAsync } from '../utils/config.js';  // May need to export this
```

#### 3. Export execAsync from config.ts
**File**: `packages/backend/src/utils/config.ts`

The `execAsync` function is defined but not exported. Add export:
```typescript
// Around line 10, change:
const execAsync = promisify(exec);
// To:
export const execAsync = promisify(exec);
```

### Success Criteria:

#### Automated Verification:
- [ ] Backend builds successfully: `pnpm --filter @haflow/backend build`
- [ ] All existing tests pass: `pnpm --filter @haflow/backend test`
- [ ] TypeScript compilation has no errors

#### Manual Verification:
- [ ] Can call `POST /api/missions/:id/run-command` with `{ command: "ls -la" }`
- [ ] Can poll `GET /api/missions/:id/execution/:execId` to get output
- [ ] Can call `GET /api/missions/:id/git-diff` to get full diff

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 3: Mission Engine Code-Review Support

### Overview
Update the mission engine to handle `code-review` step type transitions.

### Changes Required:

#### 1. Mission Engine Updates
**File**: `packages/backend/src/services/mission-engine.ts`

Update `continueMission` function to handle `code-review` type (around line 37):

```typescript
async function continueMission(missionId: string): Promise<void> {
  const meta = await missionStore.getMeta(missionId);
  if (!meta) throw new Error(`Mission not found: ${missionId}`);

  const workflow = getWorkflowById(meta.workflow_id) || getDefaultWorkflow();
  const currentStep = workflow.steps[meta.current_step];

  if (!currentStep) {
    // All steps complete
    await missionStore.updateMeta(missionId, { status: 'completed' });
    return;
  }

  if (currentStep.type === 'human-gate' || currentStep.type === 'code-review') {
    // Human approved - advance to next step
    await advanceToNextStep(missionId, meta);
  } else if (currentStep.type === 'agent') {
    // Start agent run
    await startAgentStep(missionId, meta, currentStep);
  }
}
```

Update `advanceToNextStep` function to handle `code-review` status (around line 60):

```typescript
// Determine new status based on next step type
let newStatus: MissionStatus;
if (nextStep.type === 'human-gate') {
  newStatus = 'waiting_human';
} else if (nextStep.type === 'code-review') {
  newStatus = 'waiting_code_review';
} else {
  newStatus = 'ready';
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Backend builds successfully: `pnpm --filter @haflow/backend build`
- [ ] All existing tests pass: `pnpm --filter @haflow/backend test`

#### Manual Verification:
- [ ] When agent step completes, mission transitions to `waiting_code_review` if next step is `code-review`
- [ ] Calling `/continue` on a `code-review` step advances to next step

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 4: Workflow Configuration Updates

### Overview
Update workflow definitions to use `code-review` step after codegen steps.

### Changes Required:

#### 1. Workflow Definitions
**File**: `packages/backend/src/services/workflow.ts`

Update the `raw-research-plan-implement` workflow (line 16):
```typescript
// Change from:
{ step_id: 'review-impl', name: 'Review Implementation', type: 'human-gate', reviewArtifact: 'implementation-result.json', workspaceMode: 'document' },
// To:
{ step_id: 'review-impl', name: 'Review Implementation', type: 'code-review', workspaceMode: 'codegen', quickCommands: ['npm test', 'npm run lint', 'npm run build'] },
```

Update the `oneshot` workflow (line 24):
```typescript
// Change from:
{ step_id: 'review', name: 'Review', type: 'human-gate', reviewArtifact: 'implementation-result.json', workspaceMode: 'document' },
// To:
{ step_id: 'review', name: 'Review', type: 'code-review', workspaceMode: 'codegen', quickCommands: ['npm test', 'npm run lint', 'npm run build'] },
```

### Success Criteria:

#### Automated Verification:
- [ ] Backend builds successfully: `pnpm --filter @haflow/backend build`
- [ ] All existing tests pass: `pnpm --filter @haflow/backend test`

#### Manual Verification:
- [ ] Workflow definitions show `code-review` type in API responses

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 5: Frontend API Client Updates

### Overview
Add API client functions for the new endpoints.

### Changes Required:

#### 1. API Client
**File**: `packages/frontend/src/api/client.ts`

Add new functions:

```typescript
export async function runCommand(
  missionId: string,
  command: string,
  timeout?: number
): Promise<{ executionId: string }> {
  const res = await fetch(`${API_BASE}/missions/${missionId}/run-command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, timeout }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to run command');
  return json.data;
}

export async function getExecution(
  missionId: string,
  executionId: string
): Promise<{
  id: string;
  command: string;
  status: 'running' | 'completed' | 'failed';
  output: string;
  exitCode?: number;
  startedAt: string;
  finishedAt?: string;
}> {
  const res = await fetch(`${API_BASE}/missions/${missionId}/execution/${executionId}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to get execution');
  return json.data;
}

export async function getFullDiff(missionId: string): Promise<{ diff: string }> {
  const res = await fetch(`${API_BASE}/missions/${missionId}/git-diff`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to get diff');
  return json.data;
}

export async function getFileDiff(
  missionId: string,
  filePath: string
): Promise<{ diff: string }> {
  const res = await fetch(`${API_BASE}/missions/${missionId}/git-diff/${encodeURIComponent(filePath)}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to get file diff');
  return json.data;
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Frontend builds successfully: `pnpm --filter frontend build`
- [ ] Frontend lint passes: `pnpm --filter frontend lint`

#### Manual Verification:
- [ ] API functions are callable from frontend code

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 6: Frontend CodeReviewStep Component

### Overview
Create the main UI component for the code-review step.

### Changes Required:

#### 1. CodeReviewStep Component
**File**: `packages/frontend/src/components/CodeReviewStep.tsx` (NEW)

```tsx
import { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { RefreshCw, Play, Check, FileCode, Terminal } from 'lucide-react';
import { runCommand, getExecution, getFileDiff, getGitStatus } from '../api/client';
import type { MissionDetail, WorkflowStep } from '@haflow/shared';

interface CodeReviewStepProps {
  mission: MissionDetail;
  step: WorkflowStep;
  onContinue: () => void;
}

interface GitFile {
  path: string;
  status: string;
}

interface ExecutionState {
  id: string;
  status: 'running' | 'completed' | 'failed';
  output: string;
  command: string;
}

export function CodeReviewStep({ mission, step, onContinue }: CodeReviewStepProps) {
  const [gitFiles, setGitFiles] = useState<GitFile[]>([]);
  const [gitSummary, setGitSummary] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileDiff, setFileDiff] = useState<string>('');
  const [command, setCommand] = useState('');
  const [execution, setExecution] = useState<ExecutionState | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const quickCommands = step.quickCommands || ['npm test', 'npm run lint', 'npm run build'];

  // Fetch git status
  const fetchGitStatus = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const status = await getGitStatus(mission.mission_id);
      setGitFiles(status.files);
      setGitSummary(status.summary);
    } catch (err) {
      console.error('Failed to fetch git status:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [mission.mission_id]);

  // Initial fetch
  useEffect(() => {
    fetchGitStatus();
  }, [fetchGitStatus]);

  // Fetch file diff when selected
  useEffect(() => {
    if (!selectedFile) {
      setFileDiff('');
      return;
    }

    getFileDiff(mission.mission_id, selectedFile)
      .then(res => setFileDiff(res.diff))
      .catch(err => {
        console.error('Failed to fetch diff:', err);
        setFileDiff('Error loading diff');
      });
  }, [mission.mission_id, selectedFile]);

  // Poll execution status
  useEffect(() => {
    if (!execution || execution.status !== 'running') return;

    const interval = setInterval(async () => {
      try {
        const result = await getExecution(mission.mission_id, execution.id);
        setExecution({
          id: result.id,
          status: result.status,
          output: result.output,
          command: execution.command,
        });
      } catch (err) {
        console.error('Failed to poll execution:', err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [mission.mission_id, execution]);

  // Run command handler
  const handleRunCommand = async (cmd: string) => {
    if (!cmd.trim()) return;

    try {
      const result = await runCommand(mission.mission_id, cmd);
      setExecution({
        id: result.executionId,
        status: 'running',
        output: '',
        command: cmd,
      });
    } catch (err) {
      console.error('Failed to run command:', err);
    }
  };

  const statusColors: Record<string, string> = {
    M: 'text-yellow-500',  // Modified
    A: 'text-green-500',   // Added
    D: 'text-red-500',     // Deleted
    '?': 'text-blue-500',  // Untracked
  };

  return (
    <div className="space-y-4">
      {/* Git Status Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileCode className="h-4 w-4" />
            Git Status
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchGitStatus}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {gitFiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No changes detected</p>
          ) : (
            <div className="space-y-1">
              {gitFiles.map(file => (
                <button
                  key={file.path}
                  className={`w-full text-left px-2 py-1 text-sm font-mono rounded hover:bg-muted flex items-center gap-2 ${
                    selectedFile === file.path ? 'bg-muted' : ''
                  }`}
                  onClick={() => setSelectedFile(selectedFile === file.path ? null : file.path)}
                >
                  <span className={statusColors[file.status] || 'text-foreground'}>
                    {file.status}
                  </span>
                  <span className="truncate">{file.path}</span>
                </button>
              ))}
            </div>
          )}
          {gitSummary && (
            <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">
              {gitSummary}
            </pre>
          )}
        </CardContent>
      </Card>

      {/* Diff Viewer */}
      {selectedFile && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium font-mono">
              {selectedFile}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <pre className="text-xs font-mono overflow-auto max-h-96 p-2 bg-muted rounded whitespace-pre-wrap">
              {fileDiff || 'Loading...'}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Command Runner */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            Run Command
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {/* Quick Commands */}
          <div className="flex flex-wrap gap-2">
            {quickCommands.map(cmd => (
              <Button
                key={cmd}
                variant="outline"
                size="sm"
                onClick={() => handleRunCommand(cmd)}
                disabled={execution?.status === 'running'}
              >
                {cmd}
              </Button>
            ))}
          </div>

          {/* Custom Command Input */}
          <div className="flex gap-2">
            <Input
              placeholder="Enter command..."
              value={command}
              onChange={e => setCommand(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRunCommand(command)}
              className="font-mono text-sm"
            />
            <Button
              onClick={() => handleRunCommand(command)}
              disabled={execution?.status === 'running' || !command.trim()}
            >
              <Play className="h-4 w-4" />
            </Button>
          </div>

          {/* Command Output */}
          {execution && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">$ {execution.command}</span>
                {execution.status === 'running' && (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                )}
              </div>
              <pre className="text-xs font-mono overflow-auto max-h-64 p-2 bg-muted rounded whitespace-pre-wrap">
                {execution.output || (execution.status === 'running' ? 'Running...' : 'No output')}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        <Button onClick={onContinue} data-testid="approve-continue-button">
          <Check className="h-4 w-4 mr-2" />
          Approve & Continue
        </Button>
      </div>
    </div>
  );
}
```

#### 2. Add getGitStatus to API client
**File**: `packages/frontend/src/api/client.ts`

Add function (if not already present):
```typescript
export async function getGitStatus(missionId: string): Promise<{
  hasChanges: boolean;
  files: Array<{ path: string; status: string }>;
  summary: string;
}> {
  const res = await fetch(`${API_BASE}/missions/${missionId}/git-status`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to get git status');
  return json.data;
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Frontend builds successfully: `pnpm --filter frontend build`
- [ ] Frontend lint passes: `pnpm --filter frontend lint`

#### Manual Verification:
- [ ] Component renders without errors
- [ ] Git status list displays correctly
- [ ] Clicking a file shows its diff
- [ ] Quick command buttons work
- [ ] Custom command input works
- [ ] Output polls and updates

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 7: Integrate CodeReviewStep into MissionDetail

### Overview
Update MissionDetail to render CodeReviewStep when at a code-review step.

### Changes Required:

#### 1. MissionDetail Updates
**File**: `packages/frontend/src/components/MissionDetail.tsx`

Add import at top:
```typescript
import { CodeReviewStep } from './CodeReviewStep';
```

Add status config for `waiting_code_review` (around line 21-29):
```typescript
const statusConfig: Record<MissionStatus, { label: string; variant: ... }> = {
  // ... existing statuses
  waiting_code_review: { label: 'Review Code', variant: 'secondary' },
  // ...
};
```

In the main render, add a condition for code-review steps (around line 278, before the human-gate editor section):

```typescript
{/* Code Review Step */}
{mission.status === 'waiting_code_review' && currentStep?.type === 'code-review' && (
  <CodeReviewStep
    mission={mission}
    step={currentStep}
    onContinue={onContinue}
  />
)}

{/* Human Gate Editor (existing) */}
{shouldShowHumanGateEditor && (
  // ... existing code
)}
```

Update the `shouldShowHumanGateEditor` logic to exclude code-review (line 230-235):
```typescript
const shouldShowHumanGateEditor =
  artifactName &&
  currentStep?.type !== 'code-review' && (
    mission.status === 'waiting_human' ||
    ((mission.status === 'ready' || mission.status === 'draft') && currentStep?.type === 'human-gate')
  )
```

### Success Criteria:

#### Automated Verification:
- [ ] Frontend builds successfully: `pnpm --filter frontend build`
- [ ] Frontend lint passes: `pnpm --filter frontend lint`

#### Manual Verification:
- [ ] When mission reaches code-review step, CodeReviewStep component is displayed
- [ ] "Approve & Continue" advances to next step
- [ ] Status badge shows "Review Code" for waiting_code_review

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 8: End-to-End Testing

### Overview
Verify the complete flow works from implementation step through code review.

### Success Criteria:

#### Manual Verification:
1. [ ] Create a new mission with a linked project
2. [ ] Run through workflow to implementation step
3. [ ] After implementation completes, mission shows code-review UI
4. [ ] Git status shows all changed files
5. [ ] Clicking a file shows its diff in unified format
6. [ ] Running `npm test` (or similar) shows output
7. [ ] Running custom commands works
8. [ ] "Approve & Continue" advances mission to completion
9. [ ] Mission shows as completed after approval

---

## Testing Strategy

### Unit Tests

#### Backend
- `command-runner.ts`: Test executeCommand returns execution ID
- `command-runner.ts`: Test getExecution returns correct status
- `mission-engine.ts`: Test code-review step transitions

#### Frontend
- `CodeReviewStep.tsx`: Test renders git status list
- `CodeReviewStep.tsx`: Test clicking file shows diff
- `CodeReviewStep.tsx`: Test running command updates output

### Integration Tests
- Full workflow: implementation → code-review → completed
- API: POST /run-command → GET /execution polling

### Manual Testing Steps
1. Run implementation step on a test project
2. Verify git changes are visible
3. Run `npm test` and verify output
4. Approve and verify mission completes

## Performance Considerations

- Command output polling every 1 second (not too aggressive)
- Execution records auto-cleanup after 5 minutes
- Git operations are synchronous but fast for typical project sizes
- Consider adding output size limits if needed

## Migration Notes

- Existing missions with `review-impl` human-gate will continue to work
- New missions will use `code-review` step type
- No database migration needed (file-based storage)

## References

- Spec document: `thoughts/shared/docs/2026-01-25-code-review-step.md`
- Existing git API: `packages/backend/src/routes/missions.ts:122-160`
- Step type handling: `packages/backend/src/services/mission-engine.ts:37-43`
- Frontend step rendering: `packages/frontend/src/components/MissionDetail.tsx:278-421`
