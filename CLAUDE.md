# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Haloop is a **local-first orchestrator** that runs AI-assisted "missions" against real projects with human gates and ephemeral sandboxes. It consists of a React frontend, Express backend, and shared type library — all in a pnpm monorepo.

**Status**: Backend + Frontend substantially complete; CLI not started.

## Common Commands

```bash
# Install dependencies (from root)
pnpm install

# Build shared package (required before backend/frontend work)
pnpm --filter @haloop/shared build

# Run backend (Express, port 4000)
pnpm --filter @haloop/backend dev

# Run frontend (Vite, port 5173)
pnpm --filter frontend dev

# Build all packages
pnpm --filter @haloop/shared build && pnpm --filter @haloop/backend build && pnpm --filter frontend build

# Run backend tests
pnpm --filter @haloop/backend test

# Run single test file
pnpm --filter @haloop/backend vitest run tests/unit/services/mission-store.test.ts

# Run tests in watch mode
pnpm --filter @haloop/backend test:watch

# Frontend lint
pnpm --filter frontend lint
```

## Architecture

### Monorepo Structure

```
packages/
├── shared/      # @haloop/shared - Zod schemas + TypeScript types
├── backend/     # @haloop/backend - Express API + Docker sandbox
├── frontend/    # React 19 + Vite + TailwindCSS 4
└── cli/         # Empty (not implemented)
```

### Package Dependencies

- `frontend` and `backend` both depend on `@haloop/shared` (workspace:*)
- **Always build shared first** when types change: `pnpm --filter @haloop/shared build`

### Backend Architecture (packages/backend)

**Entry**: `src/index.ts` → Express server on port 4000

**Key Services**:
- `src/services/mission-store.ts` - File-based persistence under `~/.haloop/missions/`
- `src/services/mission-engine.ts` - Workflow orchestration with 1s container polling
- `src/services/docker.ts` - Docker CLI execution, label-based tracking, log capture
- `src/services/sandbox.ts` - Provider abstraction (k3s-ready interface)
- `src/services/workflow.ts` - Hardcoded 8-step "standard-feature" workflow

**Routes**: `src/routes/missions.ts` - All 6 REST endpoints

### Mission Storage Layout

```
~/.haloop/
  missions/
    m-<uuid>/
      mission.json          # MissionMeta + workflow state
      artifacts/            # Workflow artifacts (raw-input.md, etc.)
      runs/                 # r-<uuid>.json per step execution
      logs/                 # r-<uuid>.log container output
```

### Frontend Architecture (packages/frontend)

- **React 19** with React Compiler enabled
- **TanStack Query** for polling (refetchInterval: 2000, staleTime: 1000)
- **API client**: `src/api/client.ts` → `http://localhost:4000/api`
- **Mock mode**: `VITE_USE_MOCKS=false` to use real backend (default: mocks on)

### Shared Package (packages/shared)

- Zod schemas in `src/schemas.ts`
- TypeScript types inferred from schemas in `src/types.ts`
- All types exported from `src/index.ts`

## API Contract

All responses wrapped in `ApiResponse<T>` (`{ success, data, error }`):

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/missions` | GET | List missions |
| `/api/missions/:id` | GET | Get mission detail |
| `/api/missions` | POST | Create mission (title, type, rawInput) |
| `/api/missions/:id/artifacts/:filename` | PUT | Save artifact |
| `/api/missions/:id/continue` | POST | Advance workflow |
| `/api/missions/:id/mark-completed` | POST | Force complete |

## Testing

Backend uses **Vitest** with:
- Unit tests: `tests/unit/`
- Integration tests: `tests/integration/`
- Global setup/teardown for Docker operations
- 30s timeout for container operations
- Tests use mocks for Docker provider (no Docker required in CI)

## Workflow Pipeline (v0)

8-step pipeline alternating between agent (Docker) and human review:

1. Agent: Cleanup (`raw-input.md` → `structured-text.md`)
2. Human: Review structured
3. Agent: Research (`structured-text.md` → `research-output.md`)
4. Human: Review research
5. Agent: Planning (`research-output.md` → `implementation-plan.md`)
6. Human: Review plan
7. Agent: Implementation (`implementation-plan.md` → `implementation-result.json`)
8. Human: Review implementation

**Note**: Agent steps currently run a mock command (copy input to output). Real Claude execution not yet implemented.

## ID Conventions

- Mission IDs: `m-<uuid>` (e.g., `m-abc12345-...`)
- Run IDs: `r-<uuid>`
- Generated via `packages/backend/src/utils/id.ts`

## Environment

- `HALOOP_HOME` - Override default `~/.haloop` directory
- `VITE_USE_MOCKS` - Frontend mock mode (default: true)
- Backend runs on port 4000, frontend on 5173
