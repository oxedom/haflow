---
allowed-tools: Bash(git checkout --branch:*), Bash(git add:*), Bash(git status:*), Bash(git push:*), Bash(git commit:*), Bash(gh pr create:*)
description: Commit, push, and open a PR
---

## Context

- You have `gh` cli Installed
- Current git status: !`git status`
- Current git diff (staged and unstaged changes): !`git diff HEAD`
- Current branch: !`git branch --show-current`

# Branch Naming Conventions

feat - feat/user-authentication
enhance - enhance/search-performance
chore - chore/update-dependencies
fix - fix/login-redirect-issue
docs - docs/api-documentation
refactor - refactor/user-service
test - test/unit-tests-auth
config - config/ci-pipeline
hotfix - hotfix/critical-security-patch

## Your task

Based on the above changes:

1. Create a new branch based on the naming convention if on main
2. Create a single commit with an appropriate message
3. Push the branch to origin
4. Create a pull request using `gh pr create`
5. You have the capability to call multiple tools in a single response. You MUST do all of the above in a single message. Do not use any other tools or do anything else. Do not send any other text or messages besides these tool calls.
