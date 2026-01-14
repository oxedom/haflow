# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ralphy is a multi-project Claude Code orchestrator - a central hub for managing Claude Code missions across multiple projects. It consists of a CLI tool for setup/management, a REST API backend, and shared types.

## Build and Test Commands

```bash
# Install dependencies
pnpm install

# Build all packages (must build in dependency order: shared -> backend -> cli)
pnpm build

# Build specific package
pnpm --filter @ralphy/shared build
pnpm --filter @ralphy/backend build
pnpm --filter @ralphy/cli build

# Run tests for all packages
pnpm test

# Run tests for specific package
pnpm --filter @ralphy/backend test
pnpm --filter @ralphy/cli test
pnpm --filter @ralphy/shared test

# Watch mode for development
pnpm --filter @ralphy/backend test:watch
pnpm --filter @ralphy/cli test:watch

# Start backend server in development
pnpm --filter @ralphy/backend dev
```

## Architecture

### Monorepo Structure

This is a pnpm workspace monorepo with three packages:

- **@ralphy/shared** (`packages/shared/`) - Shared TypeScript types and enums used by both backend and CLI
- **@ralphy/backend** (`packages/backend/`) - Express REST API server with SQLite database
- **@ralphy/cli** (`packages/cli/`) - Global CLI tool (Commander.js) for managing Ralphy

### Package Dependencies

```
@ralphy/cli ─────┬──> @ralphy/backend ──> @ralphy/shared
                 └──> @ralphy/shared
```

### Key Concepts

**Projects**: Directories registered with Ralphy (stored in `~/.ralphy/ralphy.sqlite`)

**Missions**: Units of work within a project. Follow a state machine:
`draft -> generating_prd -> prd_review -> preparing_tasks -> tasks_review -> in_progress -> completed_success/failed`

**Tasks**: Individual work items within a mission, executed sequentially

### Backend Services

- **Orchestrator** (`packages/backend/src/services/orchestrator.ts`): Spawns and manages Claude CLI processes. Singleton pattern via `getOrchestrator()`.
- **MissionExecutor** (`packages/backend/src/services/mission-executor.ts`): Orchestrates mission lifecycle (PRD generation, task execution).

### Data Storage

- Global config and database: `~/.ralphy/` (configurable via `RALPHY_HOME` env var)
- Per-project artifacts: `<project>/.ralphy/missions/<mission-name>/`
- Database: SQLite via better-sqlite3

### API Routes

All routes under `/api`:
- `/projects` - CRUD for registered projects
- `/missions` - CRUD + actions (generate-prd, generate-tasks, start, stop)
- `/tasks` - Read/update tasks for a mission
- `/logs` - Query mission execution logs
- `/health` - Health check endpoint

## Testing

- Tests use Vitest with in-memory SQLite databases
- Backend route tests use supertest
- Test setup files: `packages/*/tests/setup.ts`
- Each package has `vitest.config.ts` extending base config

## CLI Commands

When installed globally, the `ralphy` CLI provides:
- `ralphy init` - Initialize `~/.ralphy/` directory and database
- `ralphy link [path]` - Register a project
- `ralphy unlink [path]` - Unregister a project
- `ralphy start` - Start the backend server
- `ralphy stop` - Stop the backend server
- `ralphy status` - Show linked projects and server status
