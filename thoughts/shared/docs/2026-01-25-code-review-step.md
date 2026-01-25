# Code Review Step Implementation Plan (Part 2)

## Overview

Add a new step type `code-review` that typically follows code-generation steps. This step provides an interactive UI for reviewing changes made by Claude in the cloned project, with buttons for git operations and the ability to run arbitrary CLI commands.

## Context

Part 1 implemented code-generation mode where:

- Claude works in a cloned project at `/workspace`
- Changes are isolated in `~/.haflow/missions/{id}/project/`
- Original project remains untouched
- Git status API endpoint exists: `GET /missions/:id/git-status`

**Gap**: After codegen completes, users need a way to:

1. See what files changed (git status)
2. View the actual diffs (git diff)
3. Run commands like `npm test`, `npm run lint`, `npm run build` to verify changes
4. Potentially run any CLI command to inspect/verify

## Desired End State

A new step type `code-review` that:

- Displays in the UI as an interactive review panel (not a human-gate approval)
- Shows git status with list of changed files
- Has "View Diff" button per file (or full diff view)
- Has command input to run arbitrary CLI commands in the cloned project
- Shows command output in real-time (streaming)
- Has "Approve & Continue" button to proceed to next step
- Has "Request Changes" button to go back to codegen step with feedback

## Key Concept

**Human-Gate** (existing):

- Simple approve/reject for artifacts (markdown files)- Shows git status with list of changed files
- Has "View Diff" button per file (or full diff view)

```
┌─────────────────────────────────────────────────────────────────┐
│ Step: Review Implementation                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📊 Git Status                                    [Refresh]     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ M  src/components/Button.tsx          [View Diff]        │   │
│  │ M  src/utils/helpers.ts               [View Diff]        │   │
│  │ A  src/components/NewComponent.tsx    [View Diff]        │   │
│  │ A  tests/Button.test.tsx              [View Diff]        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  📝 Diff Viewer                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ - old line                                               │   │
│  │ + new line                                               │   │
│  │ ...                                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  💻 Run Command                                                 │
│  ┌─────────────────────────────────────┐  [Run]                │
│  │ npm test                            │                        │
│  └─────────────────────────────────────┘                        │
│                                                                 │
│  Output:                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ > npm test                                               │   │
│  │ PASS src/components/Button.test.tsx                      │   │
│  │ ✓ renders correctly (45ms)                               │   │
│  │ ✓ handles click events (23ms)                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Quick Commands:                                                │
│  [npm test] [npm run lint] [npm run build] [git log -3]        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Feedback (optional):                                     │   │
│  │ ________________________________________________        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [← Request Changes]                    [Approve & Continue →]  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Areas

### 1. Schema Changes (shared)

- New step type: `code-review`
- Step schema additions for code-review specific config (quick commands, etc.)

### 2. Backend API Endpoints

- `POST /missions/:id/run-command` - Execute CLI command in cloned project
  - Streaming response for real-time output
  - Working directory: `~/.haflow/missions/{id}/project/`
  - Timeout handling
  - Command history/logging
- `GET /missions/:id/git-diff/:file` - Get diff for specific file (exists, may need enhancement)
- `GET /missions/:id/git-diff` - Get full diff (all files)

### 3. Mission Engine

- Handle `code-review` step type
- Pause for user interaction (like human-gate but different UI)
- Handle "Request Changes" → return to previous codegen step with feedback
- Store feedback for next iteration

### 4. Frontend Components

- New `CodeReviewStep` component
- Git status panel with file list
- Diff viewer (syntax highlighted)
- Command input with run button
- Streaming command output display
- Quick command buttons (configurable)
- Feedback textarea
- Approve/Request Changes buttons

### 5. Workflow Configuration

- Add `code-review` step after `implementation` step
- Configure quick commands per workflow/step

## Questions to Resolve

1. **Command execution security**: Should we restrict commands? Allowlist? Or trust user?
2. **Command timeout**: What's a reasonable timeout? Configurable?
3. **Streaming**: WebSocket or SSE for command output?
4. **Request Changes flow**: Does it re-run just codegen step or full workflow from there?
5. **Feedback storage**: Where does feedback go? New artifact? Appended to plan?
6. **Multiple iterations**: How many rounds of changes before forcing approval?

## Dependencies

- Part 1: Code-generation mode (✅ complete)
- Git status API endpoint (✅ exists)
- Git diff API endpoint (✅ exists, may need enhancement)

## Out of Scope (for now)

- Inline code editing in the review UI
- Auto-commit functionality
- Cherry-pick changes to original project
- Side-by-side diff view (start with unified diff)
- File tree navigation
- Syntax highlighting for all languages (start with basic)

## Success Criteria

1. User can see git status after codegen step completes
2. User can view diff for any changed file
3. User can run CLI commands and see output
4. User can approve changes and continue workflow
5. User can request changes with feedback, which re-runs codegen
6. Command execution is reasonably secure (no system-level damage)
7. UI is responsive and shows streaming output

---

## Notes for Planning Phase

This is a raw overview. Next steps:

1. Decide on command execution security model
2. Design request-changes flow (feedback → codegen iteration)
3. Break down into implementation phases
4. Design API contracts
5. Design frontend component hierarchy
