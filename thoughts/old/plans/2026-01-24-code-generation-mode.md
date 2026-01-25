# Code-Generation Mode Implementation Plan

## Overview

Add support for code-generation mode where Claude containers can work directly on a linked external project (mounted at `/workspace`) in addition to the existing document-processing mode (working on `/mission/artifacts/`). The mode is determined per workflow step, allowing hybrid approach (e.g., research in document mode, implementation in code-gen mode).

## Key Concept

**Document Mode** (current):

- Artifacts live in `~/.haflow/missions/{missionId}/artifacts/`
- Claude works at `/mission` with artifacts at `/mission/artifacts/`
- Output is markdown files (research, plans, etc.)

**Code-Gen Mode** (new):

- Linked project is **cloned** to `~/.haflow/missions/{missionId}/project/`
- Clone mounted at `/workspace` (Claude's working directory)
- Original project's `node_modules` mounted at `/workspace/node_modules` (for runtime)
- Artifacts mounted at `/workspace/artifacts` (from mission dir)
- Output is actual code changes in the cloned project
- Original project remains untouched; changes isolated to clone
- User reviews changes via git diff in clone, commits manually

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
- No project cloning logic (git clone --local)
- No git status on code changes API endpoint for frontend

### Key Discoveries:

- Docker mount logic: `packages/backend/src/services/docker.ts:274-289`
- Sandbox options: `packages/backend/src/services/sandbox.ts:14-20`
- Workflow step schema: `packages/shared/src/schemas.ts:21-29`
- CLI config: `packages/cli/src/config.ts:9-11`

## Desired End State

After implementation:

1. Workflow steps can specify `workspaceMode: 'document' | 'codegen'`
2. When `workspaceMode: 'codegen'`:
   - Project cloned via `git clone --local` to `~/.haflow/missions/{missionId}/project/`
   - Clone mounted at `/workspace` (Claude's working directory)
   - Original's `node_modules` mounted at `/workspace/node_modules` (read-only for runtime)
   - Artifacts mounted at `/workspace/artifacts` (from mission artifacts dir)
3. Before starting a codegen step:
   - Validate linked project exists
   - Check for uncommitted git changes in original (error if dirty)
   - Remove existing clone if present (fresh start)
   - Clone project to mission directory
4. After codegen step:
   - Git status/diff available via API endpoint
   - Changes isolated in clone; original project unchanged
   - User can `cd ~/.haflow/missions/{id}/project && git commit` manually
5. Existing document-processing workflows continue to work unchanged

**Verification:**

- Unit tests pass for new config reading logic
- Integration test: codegen step mounts project correctly
- E2E test: implementation step modifies files in linked project
- Existing tests still pass (no regression)
- Git diff shows changes after codegen step in frontend UI

## What We're NOT Doing

- NOT duplicating node_modules (clone excludes gitignored files; mount original's node_modules)
- NOT multiple linked projects (single global linkedProject for now)
- NOT auto-commit after codegen (user reviews changes first via git diff on frontend)
- NOT syncing changes back to original (user commits in clone, applies manually for now)

## Implementation Approach

Minimal changes following existing patterns:

1. Share config between CLI and backend (read same file)
2. Add `workspaceMode` to step schema (shared package)
3. Add `workspacePath` + `nodeModulesPath` to sandbox options (backend)
4. Conditionally mount `/workspace` and `/workspace/node_modules` in Docker (backend)
5. Add pre-flight git status check (backend)
6. Clone project to mission dir via `git clone --local` (fresh start each time)
7. Add git status API endpoint for frontend

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
│          └── project/             ← CLONE of linked project (git clone)     │
│              ├── src/             ← Claude's changes go here                │
│              ├── package.json                                               │
│              └── .git/            ← Full git history preserved              │
│                                                                             │
│  /home/user/myapp/                ← Original project (UNTOUCHED)            │
│  ├── src/                                                                   │
│  ├── package.json                                                           │
│  └── node_modules/                ← Mounted into container for runtime      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Docker bind mounts (3 mounts)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DOCKER CONTAINER                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  /workspace/                      ← CLONE mounted here (working dir)        │
│  ├── src/                         ← Claude can modify these files           │
│  ├── package.json                                                           │
│  ├── node_modules/                ← Original's node_modules (read-only)     │
│  ├── artifacts/                   ← Mission artifacts mounted here          │
│  │   └── implementation-plan.md   ← Claude reads the plan                   │
│  └── ...                                                                    │
│                                                                             │
│  Claude runs: `claude --dangerously-skip-permissions "<prompt> @implementation-plan.md "`            │
│  - Reads: ./artifacts/implementation-plan.md                                │
│  - Writes: ./src/*, ./tests/*, etc.                                         │
│  - Writes: ./artifacts/implementation-result.json                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Changes written to CLONE (not original)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            AFTER COMPLETION                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  $ cd /home/user/myapp            ← Original project                        │
│  $ git status                                                               │
│  On branch main                                                             │
│  nothing to commit, working tree clean   ← UNCHANGED!                       │
│                                                                             │
│  $ cd ~/.haflow/missions/abc123/project   ← Clone with changes              │
│  $ git status                                                               │
│  Changes not staged for commit:                                             │
│    modified:   src/components/Button.tsx                                    │
│    modified:   src/utils/helpers.ts                                         │
│                                                                             │
│  $ git diff                       ← Review Claude's changes                 │
│  ... see exactly what Claude changed ...                                    │
│                                                                             │
│  $ git add -p && git commit -m "feat: implement button component"           │
│                                                                             │
│  # Later: apply changes to original via cherry-pick, patch, or manual copy  │
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
**Changes**: Add `workspacePath` and `nodeModulesPath` to `ClaudeSandboxOptions`

```typescript
export interface ClaudeSandboxOptions {
  missionId: string;
  runId: string;
  stepId: string;
  artifactsPath: string;
  prompt: string;
  workspacePath?: string; // NEW - cloned project path to mount at /workspace
  nodeModulesPath?: string; // NEW - original's node_modules to mount (read-only)
}
```

### Success Criteria:

#### Automated Verification:

- [x] Shared package builds: `pnpm --filter @haflow/shared build`
- [x] Backend builds: `pnpm --filter @haflow/backend build`
- [x] TypeScript types compile correctly
- [x] Existing tests pass: `pnpm --filter @haflow/backend test`

#### Manual Verification:

- [ ] Review generated type definitions in `packages/shared/dist/`

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 2.

---

## Phase 2: Backend Config & Project Cloning Utils

### Overview

Enable the backend to read the `linkedProject` path from the CLI config file (`~/.haflow/config.json`). Add utilities for git status checking and project cloning. This bridges the gap between CLI and backend.

### Changes Required:

#### 1. Backend Config Utility

**File**: `packages/backend/src/utils/config.ts`
**Changes**: Add functions to read linked project, check git status, and clone project

```typescript
import { readFile, rm } from "fs/promises";
import { existsSync } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { join } from "path";

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

// Clone project to mission directory (fresh start - removes existing clone)
// Uses git clone --local for fast local cloning (hard links objects)
export async function cloneProjectToMission(
  missionId: string,
  sourcePath: string
): Promise<string> {
  const clonePath = join(config.missionsDir, missionId, "project");

  // Remove existing clone if present (fresh start)
  if (existsSync(clonePath)) {
    await rm(clonePath, { recursive: true, force: true });
  }

  // Clone using --local for speed (uses hard links for .git objects)
  // This preserves full git history for proper diff/status
  await execAsync(`git clone --local "${sourcePath}" "${clonePath}"`);

  return clonePath;
}

// Get git diff summary for a project (for UI display)
export async function getGitDiff(
  projectPath: string
): Promise<{ files: string[]; summary: string }> {
  try {
    // Get list of changed files (staged + unstaged)
    const { stdout: filesOutput } = await execAsync(
      "git diff --name-only HEAD",
      { cwd: projectPath }
    );
    const files = filesOutput.trim().split("\n").filter(Boolean);

    // Get diff stat summary
    const { stdout: statOutput } = await execAsync("git diff --stat HEAD", {
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

// Get full git diff for a specific file (for UI display)
export async function getFileDiff(
  projectPath: string,
  filePath: string
): Promise<string> {
  try {
    const { stdout } = await execAsync(`git diff HEAD -- "${filePath}"`, {
      cwd: projectPath,
    });
    return stdout;
  } catch {
    return "";
  }
}

// Get git status for a cloned project (for API endpoint)
export async function getProjectGitStatus(missionId: string): Promise<{
  hasChanges: boolean;
  files: Array<{ path: string; status: string }>;
  summary: string;
}> {
  const clonePath = join(config.missionsDir, missionId, "project");

  if (!existsSync(clonePath)) {
    return { hasChanges: false, files: [], summary: "" };
  }

  try {
    // Get porcelain status for parsing
    const { stdout: statusOutput } = await execAsync("git status --porcelain", {
      cwd: clonePath,
    });

    const files = statusOutput
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => ({
        status: line.slice(0, 2).trim(),
        path: line.slice(3),
      }));

    // Get diff stat for summary
    const { stdout: statOutput } = await execAsync("git diff --stat HEAD", {
      cwd: clonePath,
    });

    return {
      hasChanges: files.length > 0,
      files,
      summary: statOutput.trim(),
    };
  } catch {
    return { hasChanges: false, files: [], summary: "" };
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

describe("cloneProjectToMission", () => {
  // Test fresh clone
  // Test clone replaces existing (fresh start)
  // Test git history preserved
});

describe("getProjectGitStatus", () => {
  // Test no changes
  // Test with modified files
  // Test with new files
});
```

### Success Criteria:

#### Automated Verification:

- [x] Backend builds: `pnpm --filter @haflow/backend build`
- [x] New unit tests pass: `pnpm --filter @haflow/backend vitest run tests/unit/utils/config.test.ts`
- [x] All existing tests pass: `pnpm --filter @haflow/backend test`

#### Manual Verification:

- [ ] Run `haflow link /some/path` then verify backend can read it
- [ ] Test with dirty git repo - should report not clean
- [ ] Verify clone created in mission directory with full git history
- [ ] Verify re-running clone removes old clone (fresh start)

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 3.

---

f

## Phase 3: Docker Mount Changes

### Overview

Modify `startClaudeStreaming()` to conditionally mount the cloned project at `/workspace` when `workspacePath` is provided. The key insight: clone is mounted at `/workspace`, original's `node_modules` mounted separately for runtime, artifacts at `/workspace/artifacts`.

### Mount Strategy

**Document Mode** (no workspacePath):

```
/mission/              <- working directory
/mission/artifacts/    <- artifacts mount (from ~/.haflow/missions/{id}/artifacts)
```

**Code-Gen Mode** (with workspacePath + nodeModulesPath):

```
/workspace/              <- CLONE mounted here (working dir)
/workspace/node_modules/ <- Original's node_modules (read-only, for runtime)
/workspace/artifacts/    <- artifacts mount (overlays on clone's artifacts if any)
```

### Changes Required:

#### 1. Update ClaudeSandboxOptions

**File**: `packages/backend/src/services/sandbox.ts`
**Changes**: Add `nodeModulesPath` for mounting original's node_modules

```typescript
export interface ClaudeSandboxOptions {
  missionId: string;
  runId: string;
  stepId: string;
  artifactsPath: string;
  prompt: string;
  workspacePath?: string; // Cloned project path to mount at /workspace
  nodeModulesPath?: string; // Original project's node_modules to mount (read-only)
}
```

#### 2. Docker Provider - Workspace Mount

**File**: `packages/backend/src/services/docker.ts`
**Changes**: Update `startClaudeStreaming()` to handle workspace + node_modules mount

```typescript
async function* startClaudeStreaming(
  options: ClaudeSandboxOptions
): AsyncGenerator<StreamEvent, void, unknown> {
  const { artifactsPath, prompt, workspacePath, nodeModulesPath } = options;

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

  // NEW: Mount cloned workspace if in codegen mode
  if (workspacePath) {
    args.push("-v", `${workspacePath}:/workspace`);

    // Mount original's node_modules for runtime (read-only)
    // This avoids duplicating node_modules in the clone
    if (nodeModulesPath && existsSync(nodeModulesPath)) {
      args.push("-v", `${nodeModulesPath}:/workspace/node_modules:ro`);
    }
  }

  // Mount artifacts at {workingDir}/artifacts
  // In codegen mode: /workspace/artifacts (overlays clone's artifacts dir if any)
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

**Important**: Mount order matters!

1. Clone first (`/workspace`)
2. node_modules overlays (`/workspace/node_modules`)
3. Artifacts overlays (`/workspace/artifacts`)

#### 3. Update SandboxRunOptions (for non-Claude containers)

**File**: `packages/backend/src/services/sandbox.ts`
**Changes**: Add optional workspacePath and nodeModulesPath

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
  workspacePath?: string; // Cloned project path
  nodeModulesPath?: string; // Original's node_modules
  labels?: Record<string, string>;
}
```

### Success Criteria:

#### Automated Verification:

- [x] Backend builds: `pnpm --filter @haflow/backend build`
- [x] Existing tests pass: `pnpm --filter @haflow/backend test`

#### Manual Verification:

- [ ] Start a container with workspacePath and verify `/workspace` is mounted with cloned files
- [ ] Verify `/workspace/node_modules` contains original's packages (read-only)
- [ ] Verify container working directory is `/workspace`
- [ ] Verify artifacts are at `/workspace/artifacts`
- [ ] Verify changes in container appear in clone (not original)
- [ ] Verify `npm run <script>` works in container (node_modules accessible)

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 4.

---

## Phase 4: Mission Engine Integration

### Overview

Wire everything together: mission engine reads step's `workspaceMode`, fetches `linkedProject`, checks git status, clones the project, and passes `workspacePath` + `nodeModulesPath` to the sandbox.

### Flow for Code-Gen Step

```
1. Step has workspaceMode: 'codegen'
2. Read linkedProject from ~/.haflow/config.json
3. If no linkedProject → throw error
4. Check git status --porcelain in linkedProject (original must be clean)
5. If dirty → throw error with helpful message
6. Clone project: git clone --local → ~/.haflow/missions/{id}/project/
7. Start Claude container with:
   - workspacePath = clone path
   - nodeModulesPath = original's node_modules
8. Claude works in /workspace (the clone), reads plan from ./artifacts/
9. Changes written to clone (original unchanged)
10. After completion, git status API returns changes in clone
```

### Changes Required:

#### 1. Mission Engine - Codegen Support

**File**: `packages/backend/src/services/mission-engine.ts`
**Changes**: Update `runClaudeStreaming()` to handle codegen mode

```typescript
import { getLinkedProject, checkGitStatus, cloneProjectToMission } from '../utils/config.js';
import { join } from 'path';

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
  let nodeModulesPath: string | undefined;

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

    // Clone project to mission dir (fresh start - removes existing clone)
    workspacePath = await cloneProjectToMission(missionId, linkedProject);

    // Use original's node_modules for runtime
    nodeModulesPath = join(linkedProject, 'node_modules');
  }

  // ... existing abort controller setup ...

  try {
    const stream = provider.startClaudeStreaming!({
      missionId,
      runId,
      stepId: step.step_id,
      artifactsPath,
      prompt,
      workspacePath,     // Clone path
      nodeModulesPath,   // Original's node_modules
    });

    // ... rest of existing streaming logic ...
  }
}
```

#### 2. Git Status API Endpoint

**File**: `packages/backend/src/routes/missions.ts`
**Changes**: Add endpoint for getting git status of cloned project

```typescript
import { getProjectGitStatus, getFileDiff } from "../utils/config.js";

// GET /missions/:id/git-status
router.get("/:id/git-status", async (req, res) => {
  const { id } = req.params;

  try {
    const status = await getProjectGitStatus(id);
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: "Failed to get git status" });
  }
});

// GET /missions/:id/git-diff/:file
router.get("/:id/git-diff/*", async (req, res) => {
  const { id } = req.params;
  const filePath = req.params[0]; // Everything after git-diff/

  try {
    const clonePath = join(config.missionsDir, id, "project");
    const diff = await getFileDiff(clonePath, filePath);
    res.json({ diff });
  } catch (error) {
    res.status(500).json({ error: "Failed to get file diff" });
  }
});
```

### Success Criteria:

#### Automated Verification:

- [ ] Backend builds: `pnpm --filter @haflow/backend build`
- [ ] Existing tests pass: `pnpm --filter @haflow/backend test`

#### Manual Verification:

- [ ] Create mission, reach implementation step with `workspaceMode: 'codegen'`
- [ ] Verify project is cloned to `~/.haflow/missions/{id}/project/`
- [ ] Verify error thrown if no linked project
- [ ] Verify error thrown if uncommitted changes in original
- [ ] Verify clone is fresh (old clone removed)
- [ ] After step completes, verify `GET /missions/{id}/git-status` returns changes
- [ ] Verify original project is unchanged

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
- [ ] Verify Claude works in cloned project root directory
- [ ] Verify code changes appear in clone (not original)
- [ ] Verify implementation-result.json is written to artifacts
- [ ] Verify `GET /missions/{id}/git-status` shows changes
- [ ] Verify original project remains unchanged

**Implementation Note**: After completing this phase, all functionality is complete. Proceed to verification.

---

## Testing Strategy

### Unit Tests:

- `getLinkedProject()`: reads config, handles missing file, handles malformed JSON
- `checkGitStatus()`: clean repo, dirty repo, non-git directory, execution errors
- `cloneProjectToMission()`: fresh clone, replaces existing clone, preserves git history
- `getGitDiff()`: returns changed files list
- `getProjectGitStatus()`: returns status with file list
- Workflow step mode detection

### Integration Tests:

- Docker container mounts `/workspace` when `workspacePath` provided
- Docker container mounts node_modules at `/workspace/node_modules`
- Docker container mounts artifacts at `/workspace/artifacts`
- Mission engine throws on dirty git state
- Mission engine throws when no linked project for codegen step
- Mission engine clones project to mission directory
- Git status API returns correct changes

### Manual Testing Steps:

1. Link a test project: `haflow link /path/to/test-project`
2. Create a new mission with the default workflow
3. Progress through document-mode steps (cleanup, research, planning)
4. Verify implementation step:
   - Project cloned to `~/.haflow/missions/{id}/project/`
   - Clone mounted at `/workspace` in container
   - node_modules from original mounted (can run npm scripts)
   - Claude can read/write project files in clone
   - implementation-result.json created in artifacts
5. After completion:
   - Original project unchanged: `cd /path/to/test-project && git status` shows clean
   - Clone has changes: `cd ~/.haflow/missions/{id}/project && git status`
   - API shows changes: `GET /missions/{id}/git-status`
6. Test error cases:
   - No linked project → error before implementation step
   - Dirty git state in original → error with helpful message
7. Test fresh start:
   - Re-run codegen step → old clone removed, fresh clone created

## Performance Considerations

- Git status check adds ~100-500ms before codegen steps (acceptable)
- `git clone --local` is fast (~1-5s) as it uses hard links for .git objects
- Clone size is small (no node_modules, no gitignored files)
- node_modules mount is a bind mount (no copy overhead)
- Fresh start (re-clone) ensures clean state, acceptable tradeoff for simplicity
- No additional overhead for document-mode steps

## Migration Notes

- Existing missions continue to work (no `workspaceMode` = document mode)
- No database/schema migration needed
- Backward compatible: old workflow definitions still work

## Future Enhancements (Not in Scope)

- Auto-commit after successful codegen step
- UI showing git diff directly in haflow (API ready, UI not in scope)
- Sync changes from clone back to original (git format-patch, cherry-pick, etc.)
- Multiple linked projects per workspace
- Mission-level project override
- Incremental mode (reuse clone instead of fresh start)

## References

- Original research: `thoughts/shared/research/2026-01-24-code-gen.md`
- CLI config: `packages/cli/src/config.ts:9-11`
- Docker mount logic: `packages/backend/src/services/docker.ts:274-289`
- Sandbox options: `packages/backend/src/services/sandbox.ts:14-20`
- Entrypoint workspace logic: `packages/backend/docker/sandbox-templates/claude-code/entrypoint.sh:51-54`
