# Claude Configuration Summary

This document provides a birds-eye view of all files in the `.claude` directory, identifying duplicates and near-duplicates with their key differences.

## Directory Structure

```
.claude/
├── agent-template.md
├── settings.json
├── settings.local.json
├── agents/           (8 files)
├── commands/         (21 files)
└── skills/           (9 directories)
```

---

## Agents

| File | Purpose | Model | Key Difference vs Similar |
|------|---------|-------|--------------------------|
| `codebase-locator.md` | Find WHERE files/components live | sonnet | File finder only, doesn't read contents |
| `codebase-analyzer.md` | Understand HOW code works | sonnet | Deep analysis with file:line references |
| `codebase-pattern-finder.md` | Find similar implementations/patterns | sonnet | Returns code snippets, not just locations |
| `thoughts-locator.md` | Find documents in thoughts/ directory | sonnet | Mirror of codebase-locator for thoughts/ |
| `thoughts-analyzer.md` | Extract insights from thoughts docs | sonnet | Mirror of codebase-analyzer for thoughts/ |
| `web-search-researcher.md` | Web research for external info | sonnet | Uses WebSearch/WebFetch tools |
| `claude-janitor.md` | Update stale CLAUDE.md files | sonnet | Maintenance focused |
| `security-vulnerability-detector.md` | Security audit scans | opus | Very detailed, multi-phase security analysis |

---

## Commands - Duplicate Groups

### Group 1: Planning Commands

| File | Size | Key Differences |
|------|------|-----------------|
| `create_plan.md` | 14.3KB | **Full version**: Uses thoughts directory, thoughts-locator/analyzer agents, saves to `thoughts/shared/plans/` |
| `create_plan_generic.md` | 14KB | **Generic**: No "hld daemon" references, simpler subdirectory instructions |
| `create_plan_nt.md` | 13.8KB | **No-Thoughts (NT)**: Removes thoughts-locator/analyzer agents, uses `thoughts/shared/tickets/eng_XXXX.md` paths |

**Recommendation**: Keep `create_plan.md` as primary, delete `create_plan_nt.md` and `create_plan_generic.md` if thoughts directory isn't used.

---

### Group 2: Research Commands

| File | Size | Key Differences |
|------|------|-----------------|
| `research_codebase.md` | 11KB | **Full version**: Includes thoughts-locator/analyzer, runs `hack/spec_metadata.sh`, Historical Context section |
| `research_codebase_generic.md` | 8.7KB | **Generic**: Simpler metadata gathering, no specialized scripts |
| `research_codebase_nt.md` | 9.4KB | **No-Thoughts (NT)**: Removes thoughts directory references, no Historical Context section |

**Recommendation**: Keep `research_codebase.md` as primary, delete others if thoughts directory is used.

---

### Group 3: Iterate Plan Commands

| File | Size | Key Differences |
|------|------|-----------------|
| `iterate_plan.md` | 8.2KB | **Full version**: Includes thoughts-locator/analyzer for historical context |
| `iterate_plan_nt.md` | 7.8KB | **No-Thoughts (NT)**: Removes thoughts agents, simpler Step 5 (no sync) |

**Recommendation**: Keep `iterate_plan.md`, delete `iterate_plan_nt.md`.

---

### Group 4: Ralph Workflow Commands

| File | Purpose | Notes |
|------|---------|-------|
| `ralph_plan.md` | Create plan for highest priority ticket | Fetches tickets, creates plans, uses MCP tools |
| `ralph_research.md` | Research highest priority ticket | Similar flow, focuses on research phase |
| `ralph_impl.md` | Implement highest priority ticket | Uses worktrees, calls /implement_plan |
| `oneshot.md` | Research + launch planning | Chains ralph_research + planning |
| `oneshot_plan.md` | Plan + implement | Chains ralph_plan + ralph_impl |

**These are NOT duplicates** - they are workflow orchestrators with different purposes.

---

## Commands - Standalone

| File | Purpose |
|------|---------|
| `ci_commit.md` | Create atomic git commits |
| `commit-push-create-pr.md` | Full workflow: commit, push, create PR |
| `create_handoff.md` | Create handoff document for session transfer |
| `debug.md` | Debug issues with logs, DB, git history |
| `founder_mode.md` | Create GitHub issue + PR for experimental features |
| `implement_plan.md` | Execute approved plans from thoughts/shared/plans |
| `tree.md` | Generate directory tree structure |
| `validate_plan.md` | Validate implementation against plan |

---

## Skills - Duplicate Alert

### DUPLICATE FOUND: Git Worktrees

| Directory | Key Differences |
|-----------|-----------------|
| `using-git-worktrees/SKILL.md` | **Full version** (174 lines): Branch naming conventions, commit message conventions, GitHub CLI integration, push to origin steps, cleanup commands |
| `using-git-worktrees copy/SKILL.md` | **Simplified** (101 lines): Missing branch naming, no commit conventions, no GH CLI, no push steps |

**Recommendation**: DELETE `using-git-worktrees copy/` - it's an incomplete duplicate.

---

## Skills - Summary Table

| Skill Directory | Purpose | Files |
|-----------------|---------|-------|
| `complex-task-planner/` | Create PRDs for MyTraining features | SKILL.md |
| `playwright/` | E2E testing with Playwright MCP | SKILL.md, demo.sql |
| `react-best-practices/` | React performance optimization | SKILL.md, AGENTS.md, README.md, metadata.json, 35+ rule files |
| `skill-creator/` | Guide for creating new skills | SKILL.md |
| `small-to-before-research/` | Transform prompts for codebase research | SKILL.md |
| `sql-pro/` | Expert SQL development | SKILL.md |
| `sync-claude-resources/` | Sync claudeResources registry | SKILL.md |
| `using-git-worktrees/` | Create isolated git worktrees | SKILL.md |
| `using-git-worktrees copy/` | **DUPLICATE - DELETE** | SKILL.md |

---

## Cleanup Recommendations

### Files to DELETE (duplicates/incomplete):

1. **`skills/using-git-worktrees copy/`** - Incomplete duplicate of using-git-worktrees

### Files to CONSOLIDATE (if not using thoughts directory):

If you don't use the `thoughts/` directory system, you could consolidate:
- Keep only `create_plan_nt.md` (rename to `create_plan.md`)
- Keep only `research_codebase_nt.md` (rename to `research_codebase.md`)
- Keep only `iterate_plan_nt.md` (rename to `iterate_plan.md`)

If you DO use thoughts directory, keep the full versions and delete the `_nt` variants.

---

## File Count Summary

| Category | Count |
|----------|-------|
| Agents | 8 |
| Commands | 21 |
| Skills | 9 directories (1 is duplicate) |
| **Total unique configs** | ~37 |
| **Duplicates/near-duplicates** | ~4 |

---

## Key Naming Conventions

- `_nt` suffix = "No Thoughts" - removes thoughts directory integration
- `_generic` suffix = Simplified version for broader use
- `ralph_*` prefix = Workflow commands for ticket management
- `codebase-*` prefix = Agents for source code analysis
- `thoughts-*` prefix = Agents for thoughts directory analysis
