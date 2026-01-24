---
title: Workflow Pipeline
description: The 8-step mission workflow
order: 3
---

## Overview

Haflow uses an 8-step pipeline that alternates between AI agent steps and human review gates.

## The Pipeline

| Step | Type | Input | Output |
|------|------|-------|--------|
| 1 | Agent | `raw-input.md` | `structured-text.md` |
| 2 | Human | Review structured text | Approval |
| 3 | Agent | `structured-text.md` | `research-output.md` |
| 4 | Human | Review research | Approval |
| 5 | Agent | `research-output.md` | `implementation-plan.md` |
| 6 | Human | Review plan | Approval |
| 7 | Agent | `implementation-plan.md` | `implementation-result.json` |
| 8 | Human | Review implementation | Completion |

## Agent Steps

Agent steps run in isolated Docker containers. The container:

1. Receives input artifacts from the previous step
2. Processes them (currently mock implementation)
3. Produces output artifacts for the next step
4. Is destroyed after completion

## Human Gates

Human review steps require explicit approval before the mission can continue. This ensures:

- Quality control at each stage
- Opportunity to provide feedback
- Safe iteration on complex tasks

## Customizing Workflows

The current workflow is hardcoded in `src/services/workflow.ts`. Future versions will support:

- Custom step definitions
- Conditional branching
- Parallel execution paths
