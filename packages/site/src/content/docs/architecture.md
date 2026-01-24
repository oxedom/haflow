---
title: Architecture
description: Understanding Haflow's architecture and components
order: 2
---

## Overview

Haflow is a pnpm monorepo with three main packages:

```
packages/
├── shared/      # @haflow/shared - Zod schemas + TypeScript types
├── backend/     # @haflow/backend - Express API + Docker sandbox
├── frontend/    # React 19 + Vite + TailwindCSS 4
└── cli/         # (Not yet implemented)
```

## Backend

The backend is an Express server running on port 4000 with the following services:

### Mission Store

File-based persistence under `~/.haflow/missions/`:

```
~/.haflow/
  missions/
    m-<uuid>/
      mission.json     # MissionMeta + workflow state
      artifacts/       # Workflow artifacts
      runs/            # Step execution records
      logs/            # Container output
```

### Mission Engine

Orchestrates workflow execution with 1-second container polling. Manages the state machine for mission progression.

### Docker Service

Handles Docker CLI execution, label-based container tracking, and log capture for agent steps.

### Sandbox Provider

Abstraction layer for container execution (designed to support k3s in the future).

## Frontend

React 19 application with:

- **TanStack Query** for data fetching with 2-second polling
- **Radix UI** primitives for accessible components
- **TailwindCSS 4** for styling

## Shared Package

Contains Zod schemas and TypeScript types used by both frontend and backend:

- `MissionMeta` - Mission metadata and status
- `StepRun` - Individual step execution records
- `ApiResponse<T>` - Standard API response wrapper
