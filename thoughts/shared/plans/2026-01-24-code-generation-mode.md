# Code-Generation Mode Implementation Plan

## Overview

Add support for code-generation mode where Claude containers can work directly on a linked external project (mounted at `/workspace`) in addition to the existing document-processing mode (working on `/mission/artifacts/`). The mode is determined per workflow step, allowing hybrid approach (e.g., research in document mode, implementation in code-gen mode).

## Key Concept

**Document Mode** (current):

- Artifacts live in `~/.haflow/missions/{missionId}/artifacts/`
- Claude works at `/mission` with artifacts at `/mission/artifacts/`
- Output is markdown files (research, plans, etc.)

**Code-Gen Mode** (new):

- Linked project mounted at `/workspace`
- Claude works directly in the project root (`/workspace`)
- Artifacts mounted at `/workspace/artifacts` (from mission dir)
- Symlink created in mission dir pointing to project for git tracking
- Output is actual code changes to the project
- Claude links project `/mission/artifacts/{LINKED-PROJECT}` to docker instance, so we can see code changes

## Current State Analysis

**What exists:**

- CLI `link` command saves `linkedProject` to `~/.haflow/config.json`
- Entrypoint already handles `/workspace`: `if [ -d "/workspace" ]; then cd /workspace; fi`
- Docker service mounts artifacts at `/mission/artifacts/`

**What's missing:**

- Backend has no knowledge of `linkedProject`
- `WorkflowStepSchema` has no `workspaceMode` field
- `ClaudeSandboxOptions` has no `workspacePath` field
- Docker `startClaudeStreaming()` never mounts `/workspace`
- No git status check before code-gen steps
- No symlink in mission dir to track which project was modified

### Key Discoveries:

- Entrypoint ready: `packages/backend/docker/sandbox-templates/claude-code/entrypoint.sh:51-54`
- Docker mount logic: `packages/backend/src/services/docker.ts:274-289`
- Sandbox options: `packages/backend/src/services/sandbox.ts:14-20`
- Workflow step schema: `packages/shared/src/schemas.ts:21-29`
- CLI config: `packages/cli/src/config.ts:9-11`

## Desired End State

After implementation:

1. Workflow steps can specify `workspaceMode: 'document' | 'codegen'`
2. When `workspaceMode: 'codegen'`:
   - Container mounts linked project at `/workspace`
   - Claude's working directory is `/workspace`
   - Artifacts mounted at `/workspace/artifacts` (from mission artifacts dir)
   - Symlink created at `~/.haflow/missions/{missionId}/project` → linked project path
3. Before starting a codegen step:
   - Validate linked project exists
   - Check for uncommitted git changes (error if dirty)
4. After codegen step:
   - Git status/diff available to see what changed
   - Changes tracked in the actual project (not copied out)
5. Existing document-processing workflows continue to work unchanged

**Verification:**

- Unit tests pass for new config reading logic
- Integration test: codegen step mounts project correctly
- E2E test: implementation step modifies files in linked project
- Existing tests still pass (no regression)
- Git diff shows changes after codegen step

## What We're NOT Doing

- NOT cloning the project (use linked project directly via mount)
- NOT mission-level project override (step uses global linkedProject)
- NOT multiple linked projects (single global linkedProject for now)
- NOT auto-commit after codegen (user reviews changes first via git diff)

## Implementation Approach

Minimal changes following existing patterns:

1. Share config between CLI and backend (read same file)
2. Add `workspaceMode` to step schema (shared package)
3. Add `workspacePath` to sandbox options (backend)
4. Conditionally mount `/workspace` in Docker (backend)
5. Add pre-flight git status check (backend)
6. Create symlink in mission dir to linked project

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              HOST MACHINE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ~/.haflow/                                                                 │
│  ├── config.json                  ← { "linkedProject": "/home/user/myapp" } │
│  └── missions/                                                              │
│      └── abc123/                                                            │
│          ├── mission.json                                                   │
│          ├── artifacts/           ← research.md, plan.md, result.json       │
│          │   └── implementation-plan.md                                     │
│          └── project → /home/user/myapp   ← SYMLINK (new)                   │
│                                                                             │
│  /home/user/myapp/                ← Actual project (linked)                 │
│  ├── src/                                                                   │
│  ├── package.json                                                           │
│  └── ...                                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Docker bind mounts
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DOCKER CONTAINER                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  /workspace/                      ← PROJECT mounted here (working dir)      │
│  ├── src/                         ← Claude can modify these files           │
│  ├── package.json                                                           │
│  ├── artifacts/                   ← Mission artifacts mounted here          │
│  │   └── implementation-plan.md   ← Claude reads the plan                   │
│  └── ...                                                                    │
│                                                                             │
│  Claude runs: `claude --dangerously-skip-permissions "<prompt>"`            │
│  - Reads: ./artifacts/implementation-plan.md                                │
│  - Writes: ./src/*, ./tests/*, etc.                                         │
│  - Writes: ./artifacts/implementation-result.json                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Changes via bind mount
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            AFTER COMPLETION                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  $ cd /home/user/myapp                                                      │
│  $ git status                                                               │
│  On branch main                                                             │
│  Changes not staged for commit:                                             │
│    modified:   src/components/Button.tsx                                    │
│    modified:   src/utils/helpers.ts                                         │
│                                                                             │
│  $ git diff                                                                 │
│  ... see exactly what Claude changed ...                                    │
│                                                                             │
│  $ git add -p   # selectively stage changes                                 │
│  $ git commit -m "feat: implement button component"                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Type & Schema Changes

### Overview

Add the `workspaceMode` field to workflow steps and `workspacePath` to sandbox options. This phase is foundational - no runtime behavior changes yet.

### Changes Required:

#### 1. Shared Package - WorkflowStepSchema

**File**: `packages/shared/src/schemas.ts`
**Changes**: Add `workspaceMode` field to `WorkflowStepSchema`

```typescript
// Add workspace mode enum before WorkflowStepSchema
export const WorkspaceModeSchema = z.enum(["document", "codegen"]);

// Update WorkflowStepSchema
export const WorkflowStepSchema = z.object({
  step_id: z.string(),
  name: z.string(),
  type: StepTypeSchema,
  agent: z.string().optional(),
  inputArtifact: z.string().optional(),
  outputArtifact: z.string().optional(),
  reviewArtifact: z.string().optional(),
  workspaceMode: WorkspaceModeSchema.optional(), // NEW - defaults to 'document'
});
```

#### 2. Shared Package - Export Types

**File**: `packages/shared/src/types.ts`
**Changes**: Export the new type

```typescript
export type WorkspaceMode = z.infer<typeof WorkspaceModeSchema>;
```

#### 3. Backend - Sandbox Options Interface

**File**: `packages/backend/src/services/sandbox.ts`
**Changes**: Add `workspacePath` to `ClaudeSandboxOptions`

```typescript
export interface ClaudeSandboxOptions {
  missionId: string;
  runId: string;
  stepId: string;
  artifactsPath: string;
  prompt: string;
  workspacePath?: string; // NEW - linked project path to mount at /workspace
}
```

### Success Criteria:

#### Automated Verification:

- [ ] Shared package builds: `pnpm --filter @haflow/shared build`
- [ ] Backend builds: `pnpm --filter @haflow/backend build`
- [ ] TypeScript types compile correctly
- [ ] Existing tests pass: `pnpm --filter @haflow/backend test`

#### Manual Verification:

- [ ] Review generated type definitions in `packages/shared/dist/`

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 2.

---

## Phase 2: Backend Config & Project Linking Utils

### Overview

Enable the backend to read the `linkedProject` path from the CLI config file (`~/.haflow/config.json`). Add utilities for git status checking and project symlink creation. This bridges the gap between CLI and backend.

### Changes Required:

#### 1. Backend Config Utility

**File**: `packages/backend/src/utils/config.ts`
**Changes**: Add functions to read linked project, check git status, and create project symlink

```typescript
import { readFile, symlink, unlink, stat } from "fs/promises";
import { existsSync } from "fs";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface CliConfig {
  linkedProject?: string;
}

// Read linked project path from CLI config
export async function getLinkedProject(): Promise<string | undefined> {
  const configPath = join(config.haflowHome, "config.json");

  if (!existsSync(configPath)) {
    return undefined;
  }

  try {
    const content = await readFile(configPath, "utf8");
    const cliConfig: CliConfig = JSON.parse(content);
    return cliConfig.linkedProject;
  } catch {
    return undefined;
  }
}

// Check git status - returns clean:true if no uncommitted changes
export async function checkGitStatus(
  projectPath: string
): Promise<{ clean: boolean; error?: string }> {
  try {
    const { stdout } = await execAsync("git status --porcelain", {
      cwd: projectPath,
    });

    if (stdout.trim()) {
      return {
        clean: false,
        error: `Linked project has uncommitted changes. Please commit or stash before running codegen steps.`,
      };
    }

    return { clean: true };
  } catch (err) {
    return {
      clean: false,
      error: `Failed to check git status: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
}

// Create symlink in mission directory to linked project
// This allows git status/diff to be run from mission context
export async function createProjectSymlink(
  missionId: string,
  projectPath: string
): Promise<void> {
  const symlinkPath = join(config.missionsDir, missionId, "project");

  // Remove existing symlink if present
  try {
    const stats = await stat(symlinkPath);
    if (stats) {
      await unlink(symlinkPath);
    }
  } catch {
    // File doesn't exist, that's fine
  }

  // Create symlink: mission/project -> /path/to/linked/project
  await symlink(projectPath, symlinkPath);
}

// Get git diff summary for a project (for UI display)
export async function getGitDiff(
  projectPath: string
): Promise<{ files: string[]; summary: string }> {
  try {
    // Get list of changed files
    const { stdout: filesOutput } = await execAsync("git diff --name-only", {
      cwd: projectPath,
    });
    const files = filesOutput.trim().split("\n").filter(Boolean);

    // Get diff stat summary
    const { stdout: statOutput } = await execAsync("git diff --stat", {
      cwd: projectPath,
    });

    return {
      files,
      summary: statOutput.trim(),
    };
  } catch {
    return { files: [], summary: "" };
  }
}
```

#### 2. Add Unit Tests

**File**: `packages/backend/tests/unit/utils/config.test.ts` (new file)
**Changes**: Test the new config functions

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFile, rm, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("getLinkedProject", () => {
  // Test reading valid config
  // Test missing config file
  // Test malformed JSON
  // Test missing linkedProject field
});

describe("checkGitStatus", () => {
  // Test clean repo
  // Test dirty repo
  // Test non-git directory
});

describe("createProjectSymlink", () => {
  // Test symlink creation
  // Test symlink replacement
});
```

### Success Criteria:

#### Automated Verification:

- [ ] Backend builds: `pnpm --filter @haflow/backend build`
- [ ] New unit tests pass: `pnpm --filter @haflow/backend vitest run tests/unit/utils/config.test.ts`
- [ ] All existing tests pass: `pnpm --filter @haflow/backend test`

#### Manual Verification:

- [ ] Run `haflow link /some/path` then verify backend can read it
- [ ] Test with dirty git repo - should report not clean
- [ ] Verify symlink created in mission directory

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 3.

---

## Phase 3: Docker Mount Changes

### Overview

Modify `startClaudeStreaming()` to conditionally mount the linked project at `/workspace` when `workspacePath` is provided. The key insight: project is mounted at `/workspace`, artifacts are mounted at `/workspace/artifacts`.

### Mount Strategy

**Document Mode** (no workspacePath):

```
/mission/              <- working directory
/mission/artifacts/    <- artifacts mount (from ~/.haflow/missions/{id}/artifacts)
```

**Code-Gen Mode** (with workspacePath):

```
/workspace/            <- project mount + working directory
/workspace/artifacts/  <- artifacts mount (overlays on project if dir exists)
```

### Changes Required:

#### 1. Docker Provider - Workspace Mount

**File**: `packages/backend/src/services/docker.ts`
**Changes**: Update `startClaudeStreaming()` to handle workspace mount

```typescript
async function* startClaudeStreaming(
  options: ClaudeSandboxOptions
): AsyncGenerator<StreamEvent, void, unknown> {
  const { artifactsPath, prompt, workspacePath } = options;

  // Determine working directory based on mode
  const workingDir = workspacePath ? "/workspace" : "/mission";

  // ... existing setup code ...

  const args = [
    "run",
    "--name",
    containerName,
    "-i",
    "--user",
    `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
    "-v",
    `${claudeAuthPath}:/home/agent/.claude/.credentials.json:ro`,
  ];

  // NEW: Mount workspace FIRST if in codegen mode (project root)
  if (workspacePath) {
    args.push("-v", `${workspacePath}:/workspace`);
  }

  // Mount artifacts at {workingDir}/artifacts
  // In codegen mode: /workspace/artifacts (overlays project's artifacts dir if any)
  // In document mode: /mission/artifacts
  args.push("-v", `${artifactsPath}:${workingDir}/artifacts`);

  args.push(
    "-w",
    workingDir,
    defaultImage,
    "claude",
    "--verbose",
    "--print",
    "--output-format",
    "stream-json",
    "--dangerously-skip-permissions",
    prompt
  );

  // Mount git config if it exists on host (existing logic)
  if (existsSync(gitConfigPath)) {
    const workingDirIndex = args.indexOf("-w");
    args.splice(
      workingDirIndex,
      0,
      "-v",
      `${gitConfigPath}:/home/agent/.gitconfig:ro`
    );
  }

  // ... rest of existing code ...
}
```

**Important**: Order matters! Mount project first, then artifacts overlays `/workspace/artifacts`.

#### 2. Update SandboxRunOptions (for non-Claude containers)

**File**: `packages/backend/src/services/sandbox.ts`
**Changes**: Add optional workspacePath

```typescript
export interface SandboxRunOptions {
  missionId: string;
  runId: string;
  stepId: string;
  image: string;
  command: string[];
  env?: Record<string, string>;
  workingDir?: string;
  artifactsPath: string;
  workspacePath?: string; // NEW - linked project path
  labels?: Record<string, string>;
}
```

### Success Criteria:

#### Automated Verification:

- [ ] Backend builds: `pnpm --filter @haflow/backend build`
- [ ] Existing tests pass: `pnpm --filter @haflow/backend test`

#### Manual Verification:

- [ ] Start a container with workspacePath and verify `/workspace` is mounted with project files
- [ ] Verify container working directory is `/workspace`
- [ ] Verify artifacts are at `/workspace/artifacts`
- [ ] Verify changes in container appear in linked project on host (bind mount)

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 4.

---

## Phase 4: Mission Engine Integration

### Overview

Wire everything together: mission engine reads step's `workspaceMode`, fetches `linkedProject`, checks git status, creates project symlink, and passes `workspacePath` to the sandbox.

### Flow for Code-Gen Step

```
1. Step has workspaceMode: 'codegen'
2. Read linkedProject from ~/.haflow/config.json
3. If no linkedProject → throw error
4. Check git status --porcelain in linkedProject
5. If dirty → throw error with helpful message
6. Create symlink: ~/.haflow/missions/{id}/project → linkedProject
7. Start Claude container with workspacePath = linkedProject
8. Claude works in /workspace (the project), reads plan from ./artifacts/
9. Changes written directly to project files
10. After completion, user can run git status/diff to see changes
```

### Changes Required:

#### 1. Mission Engine - Codegen Support

**File**: `packages/backend/src/services/mission-engine.ts`
**Changes**: Update `runClaudeStreaming()` to handle codegen mode

```typescript
import { getLinkedProject, checkGitStatus, createProjectSymlink } from '../utils/config.js';

async function runClaudeStreaming(
  missionId: string,
  _meta: MissionMeta,
  step: WorkflowStep,
  runId: string,
  artifactsPath: string
): Promise<void> {
  const prompt = getStepPrompt(step);

  // Determine workspace path based on step mode
  let workspacePath: string | undefined;

  if (step.workspaceMode === 'codegen') {
    const linkedProject = await getLinkedProject();

    if (!linkedProject) {
      throw new Error('Code-generation step requires a linked project. Run: haflow link <project-path>');
    }

    // Check for uncommitted changes before starting
    const gitStatus = await checkGitStatus(linkedProject);
    if (!gitStatus.clean) {
      throw new Error(gitStatus.error || 'Linked project has uncommitted changes');
    }

    // Create symlink in mission dir for git tracking
    await createProjectSymlink(missionId, linkedProject);

    workspacePath = linkedProject;
  }

  // ... existing abort controller setup ...

  try {
    const stream = provider.startClaudeStreaming!({
      missionId,
      runId,
      stepId: step.step_id,
      artifactsPath,
      prompt,
      workspacePath,  // NEW - pass to sandbox
    });

    // ... rest of existing streaming logic ...
  }
}
```

### Success Criteria:

#### Automated Verification:

- [ ] Backend builds: `pnpm --filter @haflow/backend build`
- [ ] Existing tests pass: `pnpm --filter @haflow/backend test`

#### Manual Verification:

- [ ] Create mission, reach implementation step with `workspaceMode: 'codegen'`
- [ ] Verify linked project is mounted
- [ ] Verify error thrown if no linked project
- [ ] Verify error thrown if uncommitted changes
- [ ] Verify symlink created at `~/.haflow/missions/{id}/project`
- [ ] After step completes, verify `git diff` in linked project shows changes

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 5.

---

## Phase 5: Workflow Configuration

### Overview

Update the implementation step in the default workflow to use `workspaceMode: 'codegen'` and adjust its prompt to work with `/workspace`.

### Changes Required:

#### 1. Workflow Definition Update

**File**: `packages/backend/src/services/workflow.ts`
**Changes**: Add `workspaceMode: 'codegen'` to implementation step

```typescript
const WORKFLOWS: Record<string, Workflow> = {
  "raw-research-plan-implement": {
    workflow_id: "raw-research-plan-implement",
    name: "Raw Research Plan Implement",
    steps: [
      {
        step_id: "cleanup",
        name: "Cleanup",
        type: "agent",
        agent: "cleanup-agent",
        inputArtifact: "raw-input.md",
        outputArtifact: "structured-text.md",
      },
      {
        step_id: "review-structured",
        name: "Review Structured",
        type: "human-gate",
        reviewArtifact: "structured-text.md",
      },
      {
        step_id: "research",
        name: "Research",
        type: "agent",
        agent: "research-agent",
        inputArtifact: "structured-text.md",
        outputArtifact: "research-output.md",
      },
      {
        step_id: "review-research",
        name: "Review Research",
        type: "human-gate",
        reviewArtifact: "research-output.md",
      },
      {
        step_id: "planning",
        name: "Planning",
        type: "agent",
        agent: "planning-agent",
        inputArtifact: "research-output.md",
        outputArtifact: "implementation-plan.md",
      },
      {
        step_id: "review-plan",
        name: "Review Plan",
        type: "human-gate",
        reviewArtifact: "implementation-plan.md",
      },
      // UPDATED: Add workspaceMode
      {
        step_id: "implementation",
        name: "Implementation",
        type: "agent",
        agent: "impl-agent",
        inputArtifact: "implementation-plan.md",
        outputArtifact: "implementation-result.json",
        workspaceMode: "codegen",
      },
      {
        step_id: "review-impl",
        name: "Review Implementation",
        type: "human-gate",
        reviewArtifact: "implementation-result.json",
      },
    ],
  },
  // 'simple' workflow stays document-only
};
```

#### 2. Update Implementation Step Prompt

**File**: `packages/backend/src/services/workflow.ts`
**Changes**: Update the 'implementation' prompt to reference workspace

```typescript
const STEP_PROMPTS: Record<string, string> = {
  // ... existing prompts ...

  implementation: `You are a senior software engineer implementing a feature.

You are working in the project root directory. The implementation plan is at ./artifacts/implementation-plan.md.

Your task:
1. Read artifacts/implementation-plan.md to understand what to build
2. Explore the codebase to understand the existing patterns and conventions
3. Implement each task in the plan by modifying files in the project
4. Write tests as specified
5. Ensure code quality and follows project conventions
6. Document what was done in "artifacts/implementation-result.json" with format:
   {
     "status": "completed" | "partial" | "blocked",
     "filesCreated": ["path/to/file1", ...],
     "filesModified": ["path/to/file2", ...],
     "testsAdded": ["test descriptions..."],
     "notes": "any important notes about the implementation"
   }

Focus on: correctness, code quality, following the plan, thorough testing.

When you are satisfied with the implementation, include <promise>COMPLETE</promise> at the end of your response.`,
};
```

#### 3. Dynamic Prompt Based on Mode

**File**: `packages/backend/src/services/workflow.ts`
**Changes**: Update `getStepPrompt()` to handle mode-specific prompts

```typescript
export function getStepPrompt(step: WorkflowStep): string {
  // For codegen mode, use workspace-specific prompt
  if (step.workspaceMode === "codegen" && step.step_id === "implementation") {
    return STEP_PROMPTS["implementation"]; // Already updated above
  }

  const basePrompt = STEP_PROMPTS[step.step_id];
  if (basePrompt) return basePrompt;

  // Fallback generic prompt
  return `Read the file "${step.inputArtifact}" and process it according to the step "${step.name}".
Write your output to "${step.outputArtifact}".
When you are satisfied with the output, include <promise>COMPLETE</promise> at the end of your response.`;
}
```

### Success Criteria:

#### Automated Verification:

- [ ] Backend builds: `pnpm --filter @haflow/backend build`
- [ ] All tests pass: `pnpm --filter @haflow/backend test`
- [ ] Frontend lint passes: `pnpm --filter frontend lint`

#### Manual Verification:

- [ ] Create a mission with linked project
- [ ] Progress through to implementation step
- [ ] Verify Claude works in project root directory
- [ ] Verify code changes appear in linked project
- [ ] Verify implementation-result.json is written to artifacts
- [ ] Run `git diff` in linked project to see all changes

**Implementation Note**: After completing this phase, all functionality is complete. Proceed to verification.

---

## Testing Strategy

### Unit Tests:

- `getLinkedProject()`: reads config, handles missing file, handles malformed JSON
- `checkGitStatus()`: clean repo, dirty repo, non-git directory, execution errors
- `createProjectSymlink()`: creates symlink, replaces existing symlink
- `getGitDiff()`: returns changed files list
- Workflow step mode detection

### Integration Tests:

- Docker container mounts `/workspace` when `workspacePath` provided
- Docker container mounts artifacts at `/workspace/artifacts`
- Mission engine throws on dirty git state
- Mission engine throws when no linked project for codegen step
- Mission engine creates symlink in mission directory

### Manual Testing Steps:

1. Link a test project: `haflow link /path/to/test-project`
2. Create a new mission with the default workflow
3. Progress through document-mode steps (cleanup, research, planning)
4. Verify implementation step:
   - Project is mounted at `/workspace` in container
   - Claude can read/write project files
   - Changes appear in linked project on host (bind mount)
   - implementation-result.json created in artifacts
5. After completion:
   - Run `git status` in linked project to see changes
   - Run `git diff` to review what was modified
   - Symlink exists at `~/.haflow/missions/{id}/project`
6. Test error cases:
   - No linked project → error before implementation step
   - Dirty git state → error with helpful message

## Performance Considerations

- Git status check adds ~100-500ms before codegen steps (acceptable)
- No additional overhead for document-mode steps
- Linked project mount is a bind mount (no copy overhead)
- Symlink creation is instant

## Migration Notes

- Existing missions continue to work (no `workspaceMode` = document mode)
- No database/schema migration needed
- Backward compatible: old workflow definitions still work

## Future Enhancements (Not in Scope)

- Auto-commit after successful codegen step
- UI showing git diff directly in haflow
- Multiple linked projects per workspace
- Mission-level project override

## References

- Original research: `thoughts/shared/research/2026-01-24-code-gen.md`
- CLI config: `packages/cli/src/config.ts:9-11`
- Docker mount logic: `packages/backend/src/services/docker.ts:274-289`
- Sandbox options: `packages/backend/src/services/sandbox.ts:14-20`
- Entrypoint workspace logic: `packages/backend/docker/sandbox-templates/claude-code/entrypoint.sh:51-54`
