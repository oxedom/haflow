# Haflow Onboarding

## What is Haflow?

A **local-first AI mission orchestrator** that runs AI-assisted workflows with human review gates. Agent steps execute in isolated Docker containers.

## Tech Stack

- **Frontend**: React 19 + Vite + TailwindCSS 4 + TanStack Query
- **Backend**: Express + TypeScript
- **Shared**: Zod schemas + inferred TypeScript types
- **Runtime**: Docker containers for agent execution
- **Package Manager**: pnpm (monorepo)

## Project Structure

```
haflow/
├── packages/
│   ├── shared/          # @haflow/shared - Zod schemas + types
│   │   └── src/
│   │       ├── schemas.ts   # All Zod schemas
│   │       └── types.ts     # Inferred TS types
│   │
│   ├── backend/         # @haflow/backend - Express API
│   │   └── src/
│   │       ├── index.ts         # Entry point (port 4000)
│   │       ├── routes/
│   │       │   └── missions.ts  # REST endpoints
│   │       └── services/
│   │           ├── mission-store.ts   # File persistence (~/.haflow/)
│   │           ├── mission-engine.ts  # Workflow orchestration
│   │           ├── docker.ts          # Docker CLI wrapper
│   │           ├── sandbox.ts         # Provider abstraction
│   │           └── workflow.ts        # 8-step pipeline definition
│   │
│   ├── frontend/        # React SPA
│   │   └── src/
│   │       ├── App.tsx
│   │       ├── api/client.ts    # API client
│   │       └── components/      # UI components
│   │
│   └── cli/             # @haflow/cli (in progress)
│
└── ~/.haflow/           # Runtime data (created at runtime)
    └── missions/
        └── m-<uuid>/
            ├── mission.json    # Mission state
            ├── artifacts/      # Step outputs
            ├── runs/           # Execution records
            └── logs/           # Container logs
```

## Quick Start

```bash
# 1. Install
pnpm install

# 2. Build shared (required first!)
pnpm --filter @haflow/shared build

# 3. Run dev servers
pnpm --filter @haflow/backend dev   # localhost:4000
pnpm --filter frontend dev          # localhost:5173
```

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/missions` | List all missions |
| GET | `/api/missions/:id` | Get mission detail |
| POST | `/api/missions` | Create mission |
| PUT | `/api/missions/:id/artifacts/:filename` | Save artifact |
| POST | `/api/missions/:id/continue` | Advance workflow |
| POST | `/api/missions/:id/mark-completed` | Force complete |

## Workflow Pipeline

8-step alternating pattern:

1. **Agent**: Cleanup raw input → structured text
2. **Human**: Review structured text
3. **Agent**: Research → research output
4. **Human**: Review research
5. **Agent**: Planning → implementation plan
6. **Human**: Review plan
7. **Agent**: Implementation → result
8. **Human**: Final review

## Key Concepts

- **Mission**: A workflow instance with state, artifacts, and execution history
- **Step**: Either `agent` (Docker container) or `human` (review gate)
- **Artifact**: File produced by a step (markdown, JSON)
- **Run**: Single execution of a step with logs

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `HAFLOW_HOME` | `~/.haflow` | Data directory |
| `VITE_USE_MOCKS` | `true` | Use mock API in frontend |

## Testing

```bash
# Run all backend tests
pnpm --filter @haflow/backend test

# Single file
pnpm --filter @haflow/backend vitest run tests/unit/services/workflow.test.ts

# Watch mode
pnpm --filter @haflow/backend test:watch
```

## Build Everything

```bash
pnpm build:all
```
