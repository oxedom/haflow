---
allowed-tools: Bash(tree:*), Bash(cat:*)
description: Generate and display a directory tree structure for a subdirectory
---

## Context

- Target directory: User will specify the subdirectory path (e.g., `packages/frontend-my-training-app`, `packages/backend`, or any relative path)
- Current working directory: !`pwd`

## Your task

When the AGENT requests to see the tree structure of a directory:

1. Navigate to the specified subdirectory (or use it as a path argument to tree)
2. Generate a tree structure using: `tree -af -I 'dist|node_modules|ios|android|.git|.gitignore|.DS_Store|*.txt' <TARGET_DIR>`
3. Display the tree output directly (don't save to file unless user requests it)
4. If the directory doesn't exist, inform the user

**Command options:**

- `-a`: Include hidden files (except . and ..)
- `-f`: Print full path prefix for each file
- `-I 'pattern'`: Exclude directories/files matching the pattern

**Default exclusions:**

- `dist`: Build/distribution directories
- `node_modules`: NPM dependencies
- `ios`: IOS Build Artifacts
- `android`: Android Build Artifacts
- `.git`: Git repository metadata
- `.gitignore`: Git ignore file
- `.DS_Store`: macOS system files
- `*.txt`: Tree output files (to avoid recursion)

If no directory is specified, use the current directory or project root.
