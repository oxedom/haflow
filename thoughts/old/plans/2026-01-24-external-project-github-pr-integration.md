# External Project & GitHub PR Integration Implementation Plan

## Overview

Enable Haflow to run coding agents against external projects linked via CLI, with automatic git branch creation, code changes committed/pushed by the agent, and automatic PR creation when the workflow completes. The frontend will display the PR link and a tree view of changed files.

## Current State Analysis

### What Exists
- CLI `link` command saves project path to `~/.haflow/config.json`
- Docker containers mount only `~/.haflow/missions/<id>/artifacts/`
- Container entrypoint has unused `/workspace` logic
- DiffViewer component exists in frontend
- `gh` CLI is installed in the sandbox Docker image

### What's Missing
- Backend doesn't read CLI config
- No project path in mission schemas
- No project mount in container
- No git branch creation
- No PR creation after workflow completion
- No PR link storage or display

### Key Discoveries
- CLI config: `packages/cli/src/config.ts:6-16` - stores at `~/.haflow/config.json`
- Docker mounts: `packages/backend/src/services/docker.ts:67-85` - conditional mount pattern exists
- Mission schemas: `packages/shared/src/schemas.ts:39-50` - MissionMeta definition
- Sandbox options: `packages/backend/src/services/sandbox.ts:1-11` - container options interface

## Desired End State

1. When a mission starts, Haflow reads the linked project from CLI config
2. The project is mounted into containers at `/workspace`
3. Haflow creates a git branch (`haflow/<mission-id>`) inside the container before the agent runs
4. The agent makes code changes, commits, and pushes to origin
5. When the entire workflow completes successfully, Haflow creates a GitHub PR
6. The frontend displays the PR URL prominently
7. A tree view shows which files were changed

### Verification
- Create a mission with a linked project
- Agent step should run in `/workspace` with the project mounted
- After completion, a PR should exist on GitHub
- Frontend should show PR link and changed files tree

## What We're NOT Doing

- Editing code changes in the frontend (read-only display only)
- Handling merge conflicts (agent must resolve during execution)
- PR review integration (comments, approvals)
- Multiple linked projects per mission
- Rollback/branch cleanup on failure
- PR lifecycle tracking (merged, closed states)

## Implementation Approach

The implementation follows the data flow: CLI config → Backend → Container → Git → GitHub PR → Frontend display.

---

## Phase 1: Backend Reads CLI Config

### Overview
Make the backend aware of the linked project by reading the CLI's config file.

### Changes Required

#### 1. Add CLI Config Reader
**File**: `packages/backend/src/utils/cli-config.ts` (new file)

```typescript
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

interface CliConfig {
  linkedProject?: string;
}

const CLI_CONFIG_PATH = process.env.HAFLOW_HOME
  ? join(process.env.HAFLOW_HOME, 'config.json')
  : join(homedir(), '.haflow', 'config.json');

export async function getLinkedProject(): Promise<string | null> {
  if (!existsSync(CLI_CONFIG_PATH)) {
    return null;
  }

  try {
    const content = await readFile(CLI_CONFIG_PATH, 'utf8');
    const config: CliConfig = JSON.parse(content);

    if (config.linkedProject && existsSync(config.linkedProject)) {
      return config.linkedProject;
    }
    return null;
  } catch {
    return null;
  }
}
```

#### 2. Add Project Path to Mission Schema
**File**: `packages/shared/src/schemas.ts`

Add to `MissionMetaSchema` (after line 48):
```typescript
export const MissionMetaSchema = z.object({
  mission_id: z.string(),
  title: z.string(),
  type: MissionTypeSchema,
  workflow_id: z.string(),
  current_step: z.number(),
  status: MissionStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
  errors: z.array(z.string()),
  last_error: z.string().optional(),
  project_path: z.string().optional(),      // NEW
  branch_name: z.string().optional(),        // NEW
  pr_url: z.string().optional(),             // NEW
});
```

#### 3. Update Mission Creation
**File**: `packages/backend/src/services/mission-store.ts`

Modify `createMission` function (line 36):
```typescript
import { getLinkedProject } from '../utils/cli-config';

async function createMission(
  title: string,
  type: MissionType,
  rawInput: string,
  workflowId?: string
): Promise<MissionMeta> {
  const missionId = generateMissionId();
  const now = new Date().toISOString();

  // Get linked project from CLI config
  const projectPath = await getLinkedProject();

  // Generate branch name if project is linked
  const branchName = projectPath ? `haflow/${missionId}` : undefined;

  // ... existing workflow resolution code ...

  const meta: MissionMeta = {
    mission_id: missionId,
    title,
    type,
    workflow_id: resolvedWorkflowId,
    current_step: 0,
    status: initialStatus,
    created_at: now,
    updated_at: now,
    errors: [],
    project_path: projectPath ?? undefined,  // NEW
    branch_name: branchName,                   // NEW
  };

  // ... rest of function ...
}
```

### Success Criteria

#### Automated Verification
- [x] Build succeeds: `pnpm --filter @haflow/shared build && pnpm --filter @haflow/backend build`
- [x] Backend tests pass: `pnpm --filter @haflow/backend test`
- [x] Type checking passes for all packages

#### Manual Verification
- [ ] Create a mission after running `haflow link /path/to/project`
- [ ] GET `/api/missions/:id` returns `project_path` and `branch_name` fields
- [ ] Mission without linked project has `project_path: undefined`

---

## Phase 2: Mount Project in Container

### Overview
Modify Docker service to mount the linked project into containers at `/workspace`.

### Changes Required

#### 1. Extend Sandbox Options Interface
**File**: `packages/backend/src/services/sandbox.ts`

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
  projectPath?: string;      // NEW - host path to mount at /workspace
  branchName?: string;       // NEW - git branch to create/checkout
  labels?: Record<string, string>;
}

export interface ClaudeSandboxOptions {
  missionId: string;
  runId: string;
  stepId: string;
  artifactsPath: string;
  prompt: string;
  projectPath?: string;      // NEW
  branchName?: string;       // NEW
}
```

#### 2. Update Docker Start Function
**File**: `packages/backend/src/services/docker.ts`

Modify the `start` function (around line 67-85):
```typescript
const args = [
  'run',
  '-d',
  '--user', `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
  ...labels,
  ...envArgs,
  '-v', `${artifactsPath}:${workingDir}/artifacts`,
];

// Mount project directory if provided
if (options.projectPath && existsSync(options.projectPath)) {
  args.push('-v', `${options.projectPath}:/workspace`);
}

args.push('-w', options.projectPath ? '/workspace' : workingDir);
args.push(image || defaultImage);
args.push(...escapedCommand);
```

#### 3. Update Claude Streaming Function
**File**: `packages/backend/src/services/docker.ts`

Modify `startClaudeStreaming` (around line 274-296):
```typescript
const args = [
  'run',
  '--name', containerName,
  '-i',
  '--user', `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
  '-v', `${artifactsPath}:${workingDir}/artifacts`,
  '-v', `${claudeAuthPath}:/home/agent/.claude/.credentials.json:ro`,
];

// Mount project directory if provided
if (options.projectPath && existsSync(options.projectPath)) {
  args.push('-v', `${options.projectPath}:/workspace`);
}

args.push('-w', options.projectPath ? '/workspace' : workingDir);
```

#### 4. Pass Project Path from Mission Engine
**File**: `packages/backend/src/services/mission-engine.ts`

When starting containers, pass the project path from mission metadata:
```typescript
// In the agent step execution code
const meta = await missionStore.getMeta(missionId);

const sandboxOptions: ClaudeSandboxOptions = {
  missionId,
  runId,
  stepId: step.step_id,
  artifactsPath: join(config.missionsDir, missionId, 'artifacts'),
  prompt: stepPrompt,
  projectPath: meta?.project_path,     // NEW
  branchName: meta?.branch_name,       // NEW
};
```

### Success Criteria

#### Automated Verification
- [x] Build succeeds: `pnpm --filter @haflow/backend build`
- [x] Backend tests pass: `pnpm --filter @haflow/backend test`
- [x] Docker service unit tests updated and passing

#### Manual Verification
- [ ] Link a project: `haflow link /path/to/project`
- [ ] Create a mission and trigger an agent step
- [ ] Inspect running container: `docker exec <container> ls /workspace`
- [ ] Project files should be visible at `/workspace`

---

## Phase 3: Git Branch Creation

### Overview
Before the agent runs, create and checkout a git branch inside the container. The agent will commit and push to this branch.

### Changes Required

#### 1. Add Git Branch Setup Script
**File**: `packages/backend/docker/sandbox-templates/claude-code/git-setup.sh` (new file)

```bash
#!/bin/bash
set -e

BRANCH_NAME="$1"
WORKSPACE="/workspace"

if [ -z "$BRANCH_NAME" ]; then
    echo "No branch name provided, skipping git setup"
    exit 0
fi

if [ ! -d "$WORKSPACE/.git" ]; then
    echo "No git repository at $WORKSPACE, skipping git setup"
    exit 0
fi

cd "$WORKSPACE"

# Fetch latest from origin
git fetch origin 2>/dev/null || echo "Warning: Could not fetch from origin"

# Get the default branch (main or master)
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")

# Create branch from default branch if it doesn't exist
if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
    echo "Branch $BRANCH_NAME already exists, checking out"
    git checkout "$BRANCH_NAME"
else
    echo "Creating new branch $BRANCH_NAME from origin/$DEFAULT_BRANCH"
    git checkout -b "$BRANCH_NAME" "origin/$DEFAULT_BRANCH" 2>/dev/null || \
    git checkout -b "$BRANCH_NAME" "$DEFAULT_BRANCH" 2>/dev/null || \
    git checkout -b "$BRANCH_NAME"
fi

# Configure git user if not set
git config user.email 2>/dev/null || git config user.email "haflow@localhost"
git config user.name 2>/dev/null || git config user.name "Haflow Agent"

echo "Git setup complete: on branch $BRANCH_NAME"
```

#### 2. Update Dockerfile
**File**: `packages/backend/docker/sandbox-templates/claude-code/Dockerfile`

Add the git setup script:
```dockerfile
COPY git-setup.sh /usr/local/bin/git-setup.sh
RUN chmod +x /usr/local/bin/git-setup.sh
```

#### 3. Run Git Setup Before Agent
**File**: `packages/backend/src/services/docker.ts`

Modify `startClaudeStreaming` to run git setup first:
```typescript
// Before starting the main Claude process, run git setup
if (options.projectPath && options.branchName) {
  const gitSetupArgs = [
    'run',
    '--rm',
    '-v', `${options.projectPath}:/workspace`,
    '-w', '/workspace',
    '--user', `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
  ];

  // Mount git credentials if available
  const sshDir = join(homedir(), '.ssh');
  if (existsSync(sshDir)) {
    gitSetupArgs.push('-v', `${sshDir}:/home/agent/.ssh:ro`);
  }

  gitSetupArgs.push(defaultImage, '/usr/local/bin/git-setup.sh', options.branchName);

  try {
    await execAsync(`docker ${gitSetupArgs.join(' ')}`);
  } catch (error) {
    console.error('Git setup failed:', error);
    // Continue anyway - agent might not need git
  }
}
```

#### 4. Mount SSH Keys for Push
**File**: `packages/backend/src/services/docker.ts`

Add SSH key mounting to enable `git push`:
```typescript
// In startClaudeStreaming, add SSH mount
const sshDir = join(homedir(), '.ssh');
if (existsSync(sshDir)) {
  args.push('-v', `${sshDir}:/home/agent/.ssh:ro`);
}

// Also mount git credentials helper config
const gitCredentialsPath = join(homedir(), '.git-credentials');
if (existsSync(gitCredentialsPath)) {
  args.push('-v', `${gitCredentialsPath}:/home/agent/.git-credentials:ro`);
}
```

### Success Criteria

#### Automated Verification
- [x] Docker image builds: `docker build -t haflow/sandbox-templates:claude-code packages/backend/docker/sandbox-templates/claude-code`
- [x] Backend tests pass: `pnpm --filter @haflow/backend test`

#### Manual Verification
- [ ] Link a git repository: `haflow link /path/to/git-repo`
- [ ] Create a mission
- [ ] After agent step starts, verify branch exists: `cd /path/to/git-repo && git branch -a`
- [ ] Branch should be named `haflow/m-<uuid>`
- [ ] Agent can commit and push (check origin for pushed branch)

---

## Phase 4: Automatic PR Creation

### Overview
When the entire workflow completes successfully, automatically create a GitHub PR from the agent's branch.

### Changes Required

#### 1. Add PR Creation Service
**File**: `packages/backend/src/services/github.ts` (new file)

```typescript
import { execAsync } from './docker';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface PrResult {
  url: string;
  number: number;
}

export async function createPullRequest(
  projectPath: string,
  branchName: string,
  title: string,
  body: string
): Promise<PrResult | null> {
  if (!projectPath || !existsSync(projectPath)) {
    console.error('Project path does not exist:', projectPath);
    return null;
  }

  try {
    // Check if branch has commits ahead of default branch
    const { stdout: diffCheck } = await execAsync(
      `cd "${projectPath}" && git log origin/HEAD..${branchName} --oneline`,
      { timeout: 10000 }
    );

    if (!diffCheck.trim()) {
      console.log('No commits to create PR for');
      return null;
    }

    // Create PR using gh CLI
    const { stdout } = await execAsync(
      `cd "${projectPath}" && gh pr create --head "${branchName}" --title "${title}" --body "${body}" --json url,number`,
      { timeout: 30000 }
    );

    const result = JSON.parse(stdout);
    return {
      url: result.url,
      number: result.number,
    };
  } catch (error: any) {
    // Check if PR already exists
    if (error.message?.includes('already exists')) {
      try {
        const { stdout } = await execAsync(
          `cd "${projectPath}" && gh pr view "${branchName}" --json url,number`,
          { timeout: 10000 }
        );
        const result = JSON.parse(stdout);
        return { url: result.url, number: result.number };
      } catch {
        console.error('Failed to get existing PR:', error);
        return null;
      }
    }

    console.error('Failed to create PR:', error);
    return null;
  }
}

export async function getChangedFiles(
  projectPath: string,
  branchName: string
): Promise<string[]> {
  if (!projectPath || !existsSync(projectPath)) {
    return [];
  }

  try {
    const { stdout } = await execAsync(
      `cd "${projectPath}" && git diff --name-only origin/HEAD...${branchName}`,
      { timeout: 10000 }
    );

    return stdout.trim().split('\n').filter(Boolean);
  } catch (error) {
    console.error('Failed to get changed files:', error);
    return [];
  }
}
```

#### 2. Create PR on Workflow Completion
**File**: `packages/backend/src/services/mission-engine.ts`

Add PR creation when workflow completes:
```typescript
import { createPullRequest, getChangedFiles } from './github';

// In the workflow completion logic (when status becomes 'completed')
async function completeMission(missionId: string): Promise<void> {
  const meta = await missionStore.getMeta(missionId);
  if (!meta) return;

  let prUrl: string | undefined;
  let changedFiles: string[] = [];

  // Create PR if we have a project and branch
  if (meta.project_path && meta.branch_name) {
    // Get changed files for display
    changedFiles = await getChangedFiles(meta.project_path, meta.branch_name);

    if (changedFiles.length > 0) {
      const prResult = await createPullRequest(
        meta.project_path,
        meta.branch_name,
        `[Haflow] ${meta.title}`,
        `## Mission: ${meta.title}\n\nThis PR was automatically created by Haflow.\n\n**Mission ID**: ${meta.mission_id}\n\n### Changed Files\n${changedFiles.map(f => `- ${f}`).join('\n')}`
      );

      if (prResult) {
        prUrl = prResult.url;
      }
    }
  }

  // Update mission with PR URL
  await missionStore.updateMeta(missionId, {
    status: 'completed',
    pr_url: prUrl,
  });
}
```

#### 3. Add Changed Files to Mission Detail
**File**: `packages/shared/src/schemas.ts`

Update `MissionDetailSchema`:
```typescript
export const MissionDetailSchema = MissionMetaSchema.extend({
  workflow: WorkflowSchema,
  artifacts: z.record(z.string()),
  runs: z.array(StepRunSchema),
  current_log_tail: z.string().optional(),
  changed_files: z.array(z.string()).optional(),  // NEW
});
```

#### 4. Return Changed Files in API
**File**: `packages/backend/src/services/mission-store.ts`

Update `getDetail`:
```typescript
import { getChangedFiles } from './github';

async function getDetail(missionId: string): Promise<MissionDetail | null> {
  const meta = await getMeta(missionId);
  if (!meta) return null;

  // ... existing code ...

  // Get changed files if project is linked
  let changedFiles: string[] = [];
  if (meta.project_path && meta.branch_name) {
    changedFiles = await getChangedFiles(meta.project_path, meta.branch_name);
  }

  return {
    ...meta,
    workflow,
    artifacts,
    runs,
    current_log_tail: logTail,
    changed_files: changedFiles,  // NEW
  };
}
```

### Success Criteria

#### Automated Verification
- [x] Build succeeds: `pnpm --filter @haflow/shared build && pnpm --filter @haflow/backend build`
- [x] Backend tests pass: `pnpm --filter @haflow/backend test`
- [ ] `gh` CLI works: `gh auth status`

#### Manual Verification
- [ ] Complete a full workflow with a linked git project
- [ ] PR should be created on GitHub automatically
- [ ] Mission metadata should contain `pr_url`
- [ ] GET `/api/missions/:id` returns `changed_files` array

---

## Phase 5: Frontend PR Link & Changed Files Display

### Overview
Display the PR URL prominently in the frontend, and show a tree view of changed files.

### Changes Required

#### 1. Add PR Link Component
**File**: `packages/frontend/src/components/PrLink.tsx` (new file)

```tsx
import { ExternalLink, GitPullRequest } from 'lucide-react';

interface PrLinkProps {
  url: string;
}

export function PrLink({ url }: PrLinkProps) {
  // Extract PR number from URL
  const prNumber = url.match(/\/pull\/(\d+)/)?.[1];

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
    >
      <GitPullRequest className="w-5 h-5" />
      <span>View Pull Request {prNumber && `#${prNumber}`}</span>
      <ExternalLink className="w-4 h-4" />
    </a>
  );
}
```

#### 2. Add Changed Files Tree Component
**File**: `packages/frontend/src/components/ChangedFilesTree.tsx` (new file)

```tsx
import { File, Folder, ChevronRight, ChevronDown } from 'lucide-react';
import { useState, useMemo } from 'react';

interface ChangedFilesTreeProps {
  files: string[];
}

interface TreeNode {
  name: string;
  path: string;
  isFile: boolean;
  children: TreeNode[];
}

function buildTree(files: string[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const filePath of files) {
    const parts = filePath.split('/');
    let current = root;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = i === parts.length - 1;

      let node = current.find(n => n.name === part);
      if (!node) {
        node = { name: part, path: currentPath, isFile, children: [] };
        current.push(node);
      }
      current = node.children;
    }
  }

  return root;
}

function TreeNodeItem({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const [expanded, setExpanded] = useState(true);

  if (node.isFile) {
    return (
      <div
        className="flex items-center gap-2 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-2"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <File className="w-4 h-4 text-gray-500" />
        <span className="text-green-600 dark:text-green-400">{node.name}</span>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-2 w-full text-left"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500" />
        )}
        <Folder className="w-4 h-4 text-blue-500" />
        <span>{node.name}</span>
      </button>
      {expanded && node.children.map(child => (
        <TreeNodeItem key={child.path} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export function ChangedFilesTree({ files }: ChangedFilesTreeProps) {
  const tree = useMemo(() => buildTree(files), [files]);

  if (files.length === 0) {
    return (
      <div className="text-gray-500 text-sm py-4">
        No files changed
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 border-b">
        <span className="font-medium">{files.length} files changed</span>
      </div>
      <div className="p-2 max-h-64 overflow-auto">
        {tree.map(node => (
          <TreeNodeItem key={node.path} node={node} />
        ))}
      </div>
    </div>
  );
}
```

#### 3. Update MissionDetail to Display PR and Files
**File**: `packages/frontend/src/components/MissionDetail.tsx`

Add imports and display components:
```tsx
import { PrLink } from './PrLink';
import { ChangedFilesTree } from './ChangedFilesTree';

// In the component, add after the status display:
{mission.pr_url && (
  <div className="mb-6">
    <h3 className="text-lg font-semibold mb-2">Pull Request</h3>
    <PrLink url={mission.pr_url} />
  </div>
)}

{mission.changed_files && mission.changed_files.length > 0 && (
  <div className="mb-6">
    <h3 className="text-lg font-semibold mb-2">Changed Files</h3>
    <ChangedFilesTree files={mission.changed_files} />
  </div>
)}

{mission.branch_name && (
  <div className="text-sm text-gray-500 mb-4">
    Branch: <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{mission.branch_name}</code>
  </div>
)}
```

### Success Criteria

#### Automated Verification
- [x] Frontend builds: `pnpm --filter frontend build`
- [x] Frontend lint passes: `pnpm --filter frontend lint` (pre-existing lint errors unrelated to these changes)
- [x] No TypeScript errors

#### Manual Verification
- [ ] Complete a mission with a linked project
- [ ] PR link button appears prominently after completion
- [ ] Clicking the link opens GitHub in new tab
- [ ] Changed files tree shows correct file structure
- [ ] Files are grouped by directory
- [ ] Directories can be expanded/collapsed

---

## Testing Strategy

### Unit Tests

#### Backend
- `cli-config.ts`: Test loading valid/invalid/missing config
- `github.ts`: Test PR creation (mock `execAsync`)
- `docker.ts`: Test project path mounting logic
- `mission-store.ts`: Test new schema fields

#### Frontend
- `PrLink.tsx`: Test PR number extraction, link rendering
- `ChangedFilesTree.tsx`: Test tree building from flat file list

### Integration Tests

- Create mission with linked project → verify `project_path` stored
- Run agent step → verify project mounted at `/workspace`
- Complete workflow → verify PR created and URL stored
- GET mission detail → verify `changed_files` returned

### Manual Testing Steps

1. Link a test repository: `haflow link /path/to/test-repo`
2. Create a mission with a simple implementation task
3. Verify container has project at `/workspace`
4. Verify agent creates commits on `haflow/<mission-id>` branch
5. Verify commits are pushed to origin
6. Complete all workflow steps
7. Verify PR exists on GitHub
8. Verify frontend shows PR link
9. Verify changed files tree is accurate

---

## Performance Considerations

- **Git operations**: `git-setup.sh` runs once per mission, adds ~2-5s startup time
- **PR creation**: Single API call via `gh` CLI, typically <5s
- **Changed files**: `git diff --name-only` is fast, but cache if needed
- **SSH key mounting**: Read-only mount, no performance impact

---

## Migration Notes

- Existing missions won't have `project_path`, `branch_name`, or `pr_url` - fields are optional
- No database migration needed (file-based JSON storage)
- Docker image rebuild required for git-setup.sh script
- Existing containers need restart to use new mounts

---

## Security Considerations

- SSH keys mounted read-only (`:ro`)
- Git credentials mounted read-only
- Agent runs as host user (UID/GID matching)
- Project mounted read-write (required for git operations)
- PR creation uses host's `gh` authentication

---

## References

- Research document: `thoughts/shared/research/2026-01-24-agent-artifacts-github-pr-integration.md`
- CLI link command: `packages/cli/src/index.ts:22-32`
- Docker mounts: `packages/backend/src/services/docker.ts:67-85`
- Mission schemas: `packages/shared/src/schemas.ts:39-50`
- Sandbox options: `packages/backend/src/services/sandbox.ts:1-11`
- DiffViewer component: `packages/frontend/src/components/MissionDetail.tsx:123-187`
