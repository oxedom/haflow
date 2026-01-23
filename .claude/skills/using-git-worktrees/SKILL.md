---
name: using-git-worktrees
description: Use when starting feature work that needs isolation from current workspace or before executing implementation plans - creates isolated git worktrees with smart directory selection, proper branch naming, safety verification, and automatic remote setup (project)
---

# Using Git Worktrees

## Overview
Git worktrees create isolated workspaces sharing the same repository, allowing work on multiple branches simultaneously without switching.

**Announce at start:** "I'm using the using-git-worktrees skill to set up an isolated workspace."

## Branch Naming Convention

Before creating the worktree, determine the appropriate branch name using these conventions:

### Branch Types
- **Feature branches**: `feature/description`
  - Example: `feature/user-authentication`, 
- **Bug fixes**: `bugfix/description`
- **Hotfixes**: `hotfix/description`
  - Example: `hotfix/critical-security-patch`
- **Refactoring**: `refactor/description`
  - Example: `refactor/database-layer`
- **Experiments**: `experiment/description` or `spike/description`

### Naming Rules
- Use lowercase with hyphens (kebab-case)
- Be descriptive but concise
- Include ticket/issue number if applicable
- Avoid special characters except hyphens and slashes

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
2. Commit the change with message: `chore: add .worktrees to gitignore -#{$BRANCH_NAME}`
3. Proceed with worktree creation

## Creation Steps

### 1. Determine Branch Name
Ask yourself: What type of work is this? Choose appropriate prefix and descriptive name.

### 2. Create Worktree
```bash
git worktree add ".worktrees/$BRANCH_NAME" -b "$BRANCH_NAME"
cd ".worktrees/$BRANCH_NAME"
```

### 3. Push Branch to Origin
**IMPORTANT:** Immediately push the new branch to origin to establish remote tracking:

```bash
git push -u origin "$BRANCH_NAME"
```

**Why this matters:**
- Establishes remote tracking for the branch
- Enables collaboration immediately
- Prevents "no upstream branch" errors
- Makes branch visible to team members

**If push fails**, check:
- Remote access permissions
- Network connectivity
- Branch naming conflicts


## GitHub CLI Integration

You have `gh` CLI available for enhanced workflows:

### Create PR from Worktree
```bash
# After making commits
gh pr create --title "feat: add user authentication" --body "Implements JWT-based authentication"
```

### Quick PR Creation
```bash
# Interactive PR creation
gh pr create
```

### View PR Status
```bash
gh pr status
```

## Quick Reference

| Situation | Action |
|-----------|--------|
| `.worktrees/` exists | Use it |
| `.worktrees/` doesn't exist | Create it |
| After creating branch | Push to origin immediately |
| Build/tests fail | Report failures + ask |
| Need branch name | Apply naming convention based on work type |
| Ready to create PR | Use `gh pr create` |



## Commit Message Convention

When making commits in the worktree, follow **Conventional Commits** format:

**Structure**: `type(scope): subject`

**Common types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks, dependency updates
- `perf`: Performance improvements
- `ci`: CI/CD changes

**Examples**:
```bash
git commit -m "feat(auth): add JWT token validation #{$BRANCH_NAME}"
git commit -m "fix(login): resolve memory leak in session handler #{$BRANCH_NAME}"
git commit -m "docs(readme): update installation instructions #{$BRANCH_NAME}"
git commit -m "test(auth): add unit tests for login flow #{$BRANCH_NAME}"
```

## Red Flags

**Never:**
- Skip pushing branch to origin after creation
- Forget to apply branch naming conventions

**Always:**
- Push new branch to origin immediately after creation
- Run `pnpm install` after creating worktree
- Verify clean build and test baseline
- Use conventional branch naming
- Follow commit message conventions
- Confirm remote tracking is established

## Cleanup Commands

### Remove Worktree When Done
```bash
# From main workspace
git worktree remove .worktrees/$BRANCH_NAME

# If there are uncommitted changes
git worktree remove --force .worktrees/$BRANCH_NAME
```

### List All Worktrees
```bash
git worktree list
```
