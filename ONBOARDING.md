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
└── .claude/             # Claude AI workspace configuration
    ├── agents/          # Specialized agent definitions
    ├── commands/        # Reusable command templates
    ├── skills/          # Skill modules and best practices
    ├── agent-template.md # Template for creating new agents
    └── settings.json    # Claude workspace settings
```

## .claude Folder

The `.claude` folder contains Claude AI workspace configuration for enhanced codebase interaction:

### Agents (`agents/`)
Specialized AI agents for specific tasks:
- **codebase-analyzer**: Analyzes implementation details and traces data flow
- **codebase-locator**: Finds files and components by pattern
- **codebase-pattern-finder**: Identifies architectural patterns
- **security-vulnerability-detector**: Scans for security issues
- **thoughts-analyzer**: Analyzes research and planning documents
- **web-search-researcher**: Performs web research tasks

### Commands (`commands/`)
Reusable command templates for common workflows:
- **research_codebase_generic**: Comprehensive codebase research using parallel sub-agents
- **implement_plan**: Execute implementation plans
- **create_plan_generic**: Generate implementation plans
- **validate_plan**: Review and validate plans
- **debug**: Debugging workflows
- And more...

### Skills (`skills/`)
Skill modules providing domain-specific expertise:
- **playwright**: E2E testing with Playwright
- **react-best-practices**: React development patterns
- **sql-pro**: Database and SQL expertise
- **complex-task-planner**: Planning complex multi-step tasks
- And more...

### Configuration
- **agent-template.md**: Template for creating new custom agents
- **settings.json**: Workspace settings (e.g., thinking token limits)

These resources enable Claude to work more effectively with the codebase by providing specialized knowledge and workflows.

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
