---
date: 2026-01-24T00:00:00+00:00
researcher: Claude
git_commit: 573d259
branch: main
repository: haflow
topic: "How will artifacts work when Haflow runs as a coding agent on external projects, and is the system ready for GitHub PR integration?"
tags: [research, codebase, artifacts, docker, github, cli, external-projects]
status: complete
last_updated: 2026-01-24
last_updated_by: Claude
---

# Research: Agent Artifacts & GitHub PR Integration Readiness

**Date**: 2026-01-24
**Researcher**: Claude
**Git Commit**: 573d259
**Branch**: main
**Repository**: haflow

## Research Question

How will artifacts work when Haflow is used to run coding agents on external projects (linked via CLI), and is the system ready for creating GitHub PRs instead of dealing with files directly? Should the frontend support read-only viewing of code changes (git diff) without allowing human edits?

## Summary

**The codebase is NOT ready for your desired workflow.** There is a significant gap between:
1. **What the CLI does**: Links an external project path and stores it in `~/.haflow/config.json`
2. **What the backend does**: Completely ignores the linked project - containers only mount `~/.haflow/missions/<id>/artifacts/`

The current system works in a "document-processing" mode where artifacts are markdown files passed between steps. There is **no mechanism** to:
- Mount the linked project into containers
- Let Claude make code changes to the actual project
- Extract code changes or create PRs

## Detailed Findings

### 1. CLI: Project Linking (Implemented but Unused)

The CLI has a `link` command that saves the project path:

```1:35:/home/s-linux/projects/haflow/packages/cli/src/index.ts
// link
program
  .command('link [path]')
  .description('Link a project')
  .action(async (path?: string) => {
    const target = resolve(path || process.cwd());
    await saveConfig({ linkedProject: target });
    console.log(`Linked: ${target}`);
  });
```

This is stored in `~/.haflow/config.json`:

```typescript
interface Config {
  linkedProject?: string;
}
```

**Problem**: The `linkedProject` is NEVER passed to the backend or used by containers.

### 2. Backend: No Knowledge of Linked Project

The backend config (`packages/backend/src/utils/config.ts`) has no concept of linked projects:

```9:21:/home/s-linux/projects/haflow/packages/backend/src/utils/config.ts
export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  haflowHome: process.env.HAFLOW_HOME || join(homedir(), '.haflow'),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  haflowClaudeDir: join(repoRoot, '.claude'),
  get missionsDir() {
    return join(this.haflowHome, 'missions');
  },
};
```

### 3. Docker Container Mounts (Current State)

When Claude runs in a container, it only mounts:

```274:289:/home/s-linux/projects/haflow/packages/backend/src/services/docker.ts
const args = [
  'run',
  '--name', containerName,
  '-i',
  '--user', `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
  '-v', `${artifactsPath}:${workingDir}/artifacts`,           // <-- Only artifacts!
  '-v', `${claudeAuthPath}:/home/agent/.claude/.credentials.json:ro`,
  '-w', workingDir,
  defaultImage,
  'claude',
  ...
];
```

**What's mounted:**
- `~/.haflow/missions/<id>/artifacts/` → `/mission/artifacts/` (read-write)
- `~/.claude/.credentials.json` → `/home/agent/.claude/.credentials.json` (read-only)
- `~/.gitconfig` → `/home/agent/.gitconfig` (read-only, if exists)

**What's NOT mounted:**
- ❌ The linked project directory
- ❌ GitHub credentials for creating PRs

### 4. Dockerfile Shows Intended Design (Unused)

The Dockerfile's entrypoint has logic for `/workspace`:

```51:57:/home/s-linux/projects/haflow/packages/backend/docker/sandbox-templates/claude-code/entrypoint.sh
# If a project is mounted at /workspace, use it
if [ -d "/workspace" ]; then
    cd /workspace
fi

# Create artifacts directory if it doesn't exist
mkdir -p /workspace/artifacts 2>/dev/null || true
```

And the README shows the intended usage:

```bash
docker run -it --rm \
  -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  -v $(pwd):/workspace \
  haflow/sandbox-templates:claude-code
```

**But the backend never mounts the linked project to `/workspace`!**

### 5. Current Workflow Step Artifacts

The workflow system expects markdown artifacts:

```8:17:/home/s-linux/projects/haflow/packages/backend/src/services/workflow.ts
steps: [
  { step_id: 'cleanup', inputArtifact: 'raw-input.md', outputArtifact: 'structured-text.md' },
  { step_id: 'review-structured', reviewArtifact: 'structured-text.md' },
  { step_id: 'research', inputArtifact: 'structured-text.md', outputArtifact: 'research-output.md' },
  // ...
  { step_id: 'implementation', inputArtifact: 'implementation-plan.md', outputArtifact: 'implementation-result.json' },
]
```

The final step outputs `implementation-result.json` with metadata:

```json
{
  "status": "completed" | "partial" | "blocked",
  "filesCreated": ["path/to/file1", ...],
  "filesModified": ["path/to/file2", ...],
  "testsAdded": ["test descriptions..."],
  "notes": "any important notes about the implementation"
}
```

**But no actual code changes are captured!** This is just metadata about what WOULD be changed.

### 6. Frontend Artifact Display (Human Editing Enabled)

The frontend currently allows editing artifacts in a textarea:

```319:327:/home/s-linux/projects/haflow/packages/frontend/src/components/MissionDetail.tsx
{viewMode === 'editor' ? (
  <Textarea
    data-testid="artifact-editor"
    value={editorContent}
    onChange={(e) => {
      setEditorContent(e.target.value)
      setHasChanges(true)
    }}
    className="w-full h-full min-h-75 font-mono text-sm resize-none"
  />
```

There's already a diff viewer component:

```123:187:/home/s-linux/projects/haflow/packages/frontend/src/components/MissionDetail.tsx
function DiffViewer({ original, modified }: DiffViewerProps) {
  const diffResult = useMemo(() => {
    return Diff.diffLines(original, modified)
  }, [original, modified])
  // ... renders additions/removals with color coding
}
```

## Architecture Gap Analysis

| Requirement | Current State | Needed |
|-------------|---------------|--------|
| Link external project | ✅ CLI saves path | Backend must read it |
| Mount project in container | ❌ Not implemented | Add `-v linkedProject:/workspace` |
| Claude makes code changes | ❌ Works on `/mission/artifacts/` only | Change working dir to `/workspace` |
| Capture git diff | ❌ Not implemented | Run `git diff` after agent completes |
| Create GitHub PR | ❌ Not implemented | Use `gh` CLI in container |
| Display diff in UI | ✅ DiffViewer exists | Adapt for git diff format |
| Read-only code view | ❌ Textarea is editable | Add read-only mode |

## Recommended Implementation Path

### Phase 1: Connect CLI to Backend


### Phase 2: Mount Project in Container

Modify `docker.ts` to mount the linked project:



### Phase 3: Capture Code Changes

After agent completes, capture changes:


### Phase 4: GitHub PR Integration

Two approaches:

**A. Claude creates PR directly** (simpler):
- Mount GitHub token into container
- Claude runs `gh pr create` as part of its task
- Artifact is just a link to the PR

### Phase 5: Read-Only UI for Code Changes

1. Add new artifact type: `diff` or `code-changes`
2. Display with syntax highlighting (Monaco, CodeMirror, or simple pre-formatted)
3. Remove textarea, use read-only view
4. Show file tree of changed files
5. Each file shows unified diff

## Code References

- CLI link command: `packages/cli/src/index.ts:22-32`
- CLI config storage: `packages/cli/src/config.ts:9-11`
- Backend config (missing linked project): `packages/backend/src/utils/config.ts:9-22`
- Docker container start: `packages/backend/src/services/docker.ts:257-296`
- Sandbox options interface: `packages/backend/src/services/sandbox.ts:1-20`
- Workflow definitions: `packages/backend/src/services/workflow.ts:4-28`
- Frontend DiffViewer: `packages/frontend/src/components/MissionDetail.tsx:123-187`
- Frontend artifact editor: `packages/frontend/src/components/MissionDetail.tsx:319-327`

## Open Questions

1. **Git workflow**: Should Claude commit to a branch, or should Haflow handle git operations?
2. **Conflict handling**: What if the project has uncommitted changes when a mission starts?
3. **Multiple PRs**: Should one mission = one PR, or can a mission create multiple PRs?
4. **PR lifecycle**: Should Haflow track PR status (merged, closed, needs changes)?
5. **Review integration**: Should human-gate steps show PR review comments?
6. **Rollback**: How to handle failed implementations - delete the branch? Close PR?

## Conclusion

**The project is NOT ready for the desired workflow.** The CLI and backend are disconnected - the linked project path is stored but never used. Significant work is needed:

1. **Short-term**: Connect CLI config to backend, mount project in containers
2. **Medium-term**: Capture git diffs, display in UI read-only
3. **Longer-term**: GitHub PR integration via `gh` CLI or API

The good news: The Docker image already has `gh` CLI installed and credential handling ready. The infrastructure exists, it just needs to be wired together.
