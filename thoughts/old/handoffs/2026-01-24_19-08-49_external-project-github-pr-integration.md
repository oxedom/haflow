---
date: 2026-01-24T19:08:49+02:00
researcher: Claude Opus 4.5
git_commit: 8af8ad782a1de96c8f52943c9757f8ee37e25bf8
branch: main
repository: haflow
topic: "External Project & GitHub PR Integration Implementation"
tags: [implementation, github, pr, git, docker, frontend]
status: complete
last_updated: 2026-01-24
last_updated_by: Claude Opus 4.5
type: implementation_strategy
---

# Handoff: External Project & GitHub PR Integration

## Task(s)

Implemented the 5-phase plan from `thoughts/shared/plans/2026-01-24-external-project-github-pr-integration.md`:

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Backend Reads CLI Config | **Completed** |
| Phase 2 | Mount Project in Container | **Completed** |
| Phase 3 | Git Branch Creation | **Completed** |
| Phase 4 | Automatic PR Creation | **Completed** |
| Phase 5 | Frontend PR Link & Changed Files Display | **Completed** |

All automated verification passed (builds, tests). Manual verification remains pending.

## Critical References

- Implementation plan: `thoughts/shared/plans/2026-01-24-external-project-github-pr-integration.md`
- CLI config: `packages/cli/src/config.ts` (linkedProject storage pattern)

## Recent changes

### Backend
- `packages/backend/src/utils/cli-config.ts` - NEW: Reads CLI config to get linked project path
- `packages/backend/src/services/github.ts` - NEW: PR creation and changed files detection via gh CLI
- `packages/backend/src/services/sandbox.ts:10-12,22-23` - Added projectPath/branchName to sandbox options
- `packages/backend/src/services/docker.ts:67-95` - Mount project at /workspace, SSH keys for git push
- `packages/backend/src/services/docker.ts:333-366` - Run git-setup.sh before Claude streaming
- `packages/backend/src/services/mission-store.ts:8,54-58,70-71,107-119` - Read linked project, return changed_files
- `packages/backend/src/services/mission-engine.ts:8,52-79,138-139,239-240` - Create PR on completion

### Frontend
- `packages/frontend/src/components/PrLink.tsx` - NEW: Green button linking to PR
- `packages/frontend/src/components/ChangedFilesTree.tsx` - NEW: Collapsible tree view of changed files
- `packages/frontend/src/components/MissionDetail.tsx:3,13-14,423-455` - Display PR link, branch, changed files

### Docker
- `packages/backend/docker/sandbox-templates/claude-code/git-setup.sh` - NEW: Creates/checks out haflow branch
- `packages/backend/docker/sandbox-templates/claude-code/Dockerfile:80-82` - Copy git-setup.sh

### Shared
- `packages/shared/src/schemas.ts:50-52,89` - Added project_path, branch_name, pr_url, changed_files fields

## Learnings

1. **CLI config location**: `~/.haflow/config.json` stores `linkedProject` path, respects `HAFLOW_HOME` env var
2. **Docker mount pattern**: Project mounted at `/workspace`, artifacts at `/mission/artifacts`
3. **Git setup runs separately**: Uses `docker run --rm` before main Claude container to create branch
4. **SSH/git credentials mounting**: Mounts `~/.ssh:ro`, `~/.gitconfig:ro`, `~/.git-credentials:ro` for git push
5. **PR creation uses gh CLI**: Runs `gh pr create` from host, not from container
6. **Changed files detection**: Uses `git diff --name-only origin/HEAD...{branchName}`

## Artifacts

- Plan document: `thoughts/shared/plans/2026-01-24-external-project-github-pr-integration.md` (checkboxes updated)
- New backend files:
  - `packages/backend/src/utils/cli-config.ts`
  - `packages/backend/src/services/github.ts`
  - `packages/backend/docker/sandbox-templates/claude-code/git-setup.sh`
- New frontend files:
  - `packages/frontend/src/components/PrLink.tsx`
  - `packages/frontend/src/components/ChangedFilesTree.tsx`

## Action Items & Next Steps

1. **Rebuild Docker image**: `docker build -t docker/sandbox-templates:claude-code packages/backend/docker/sandbox-templates/claude-code`
2. **Manual verification**: Test end-to-end flow:
   - `haflow link /path/to/git-repo`
   - Create mission, run agent steps
   - Verify branch created, commits pushed, PR created
   - Verify frontend shows PR link and changed files
3. **gh CLI authentication**: Ensure `gh auth status` works on host machine

## Other Notes

- All 181 backend tests pass
- Frontend builds successfully (pre-existing lint errors unrelated to this work)
- The implementation follows the data flow: CLI config → Backend → Container → Git → GitHub PR → Frontend display
- PR body includes mission title, ID, and list of changed files
- Branch naming convention: `haflow/{mission-id}` (e.g., `haflow/m-abc12345-...`)
