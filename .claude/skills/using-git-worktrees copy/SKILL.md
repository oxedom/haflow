---
name: using-git-worktrees
description: Use when starting feature work that needs isolation from current workspace or before executing implementation plans - creates isolated git worktrees with smart directory selection and safety verification (project)
---

# Using Git Worktrees

## Overview

Git worktrees create isolated workspaces sharing the same repository, allowing work on multiple branches simultaneously without switching.

**Announce at start:** "I'm using the using-git-worktrees skill to set up an isolated workspace."

## Directory Selection

### 1. Check for Existing Directory

```bash
ls -d .worktrees 2>/dev/null
```

**If found:** Use `.worktrees/`

### 2. If Not Found

Create `.worktrees/` directory.

## Safety Verification

**MUST verify directory is ignored before creating worktree:**

```bash
git check-ignore -q .worktrees 2>/dev/null
```

**If NOT ignored:**
1. Add `.worktrees/` to `.gitignore`
2. Commit the change
3. Proceed with worktree creation

## Creation Steps

### 1. Create Worktree

```bash
git worktree add ".worktrees/$BRANCH_NAME" -b "$BRANCH_NAME"
cd ".worktrees/$BRANCH_NAME"
```

### 2. Install Dependencies

```bash
pnpm install
```


### 4. Report Location

```
Worktree ready at <full-path>
Build passing, tests passing
Ready to implement <feature-name>
```

## Quick Reference

| Situation | Action |
|-----------|--------|
| `.worktrees/` exists | Use it (verify ignored) |
| `.worktrees/` doesn't exist | Create it |
| Directory not ignored | Add to .gitignore + commit |
| Build/tests fail | Report failures + ask |

## Example Workflow

```
You: I'm using the using-git-worktrees skill to set up an isolated workspace.

[Check .worktrees/ - exists]
[Verify ignored - git check-ignore confirms .worktrees/ is ignored]
[Create worktree: git worktree add .worktrees/auth -b feature/auth]
[Run pnpm install]
[Run pnpm build - success]
[Run pnpm test - 47 passing]

Worktree ready at /home/user/mono-mytrainingapp/.worktrees/auth
Build passing, tests passing
Ready to implement auth feature
```

## Red Flags

**Never:**
- Create worktree without verifying it's ignored
- Skip build/test verification
- Proceed with failing tests without asking

**Always:**
- Verify `.worktrees/` is in `.gitignore`
- Run `pnpm install` after creating worktree
- Verify clean build and test baseline