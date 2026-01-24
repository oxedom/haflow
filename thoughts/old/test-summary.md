# Backend Test Suite Summary

## Overview

The `@haflow/backend` package has a comprehensive Vitest test suite covering utils, services, and API routes. Tests use **real Docker containers** for the Docker provider tests and hit an **actual running Express server** for integration tests.

## Quick Start

```bash
# Run all tests
pnpm --filter @haflow/backend test

# Run tests in watch mode
pnpm --filter @haflow/backend test:watch

# Run tests with coverage report
pnpm --filter @haflow/backend test:coverage
```

## Test Structure

```
packages/backend/tests/
├── setup.ts              # Per-test temp directory handling
├── globalSetup.ts        # Starts Express server on port 4001
├── globalTeardown.ts     # Stops server, cleans up Docker containers
├── unit/
│   ├── utils/
│   │   ├── id.test.ts         # ID generation (5 tests)
│   │   ├── response.test.ts   # API response helpers (6 tests)
│   │   └── config.test.ts     # Environment config (6 tests)
│   └── services/
│       ├── workflow.test.ts       # Workflow service (10 tests)
│       ├── mission-store.test.ts  # File persistence (36 tests)
│       ├── docker.test.ts         # Docker provider (17 tests)
│       └── mission-engine.test.ts # Orchestration (12 tests)
└── integration/
    └── routes/
        └── missions.test.ts   # API routes (19 tests)
```

## Running Specific Tests

```bash
# Run only utils tests
pnpm --filter @haflow/backend test tests/unit/utils

# Run only service tests
pnpm --filter @haflow/backend test tests/unit/services

# Run only integration tests
pnpm --filter @haflow/backend test tests/integration

# Run a specific test file
pnpm --filter @haflow/backend test tests/unit/services/docker

# Run tests matching a pattern
pnpm --filter @haflow/backend test -t "createMission"
```

## Test Categories

### Unit Tests - Utils (17 tests)
Fast, pure function tests with no external dependencies.

| File | Tests | Description |
|------|-------|-------------|
| `id.test.ts` | 5 | `generateMissionId()` and `generateRunId()` |
| `response.test.ts` | 6 | `sendSuccess()` and `sendError()` helpers |
| `config.test.ts` | 6 | Environment variable handling |

### Unit Tests - Services (75 tests)
Service layer tests, some with mocks.

| File | Tests | Description |
|------|-------|-------------|
| `workflow.test.ts` | 10 | Static workflow data validation |
| `mission-store.test.ts` | 36 | File-based persistence with temp directories |
| `docker.test.ts` | 17 | **Real Docker containers** - requires Docker daemon |
| `mission-engine.test.ts` | 12 | Orchestration with mocked Docker provider |

### Integration Tests (19 tests)
Full API tests against the running Express server.

| File | Tests | Description |
|------|-------|-------------|
| `missions.test.ts` | 19 | All `/api/missions` endpoints via supertest |

## Prerequisites

### Docker Daemon
The Docker provider tests require a running Docker daemon:

```bash
# Verify Docker is available
docker version

# Check for any orphaned test containers
docker ps -a --filter="label=haflow.mission_id"
```

### Environment
Tests automatically:
- Create temp directories per-test (cleaned up after)
- Start Express server on port 4001 (via globalSetup)
- Clean up Docker containers (via globalTeardown)

## Coverage Report

```bash
pnpm --filter @haflow/backend test:coverage
```

Coverage is generated in `packages/backend/coverage/`:
- `coverage/index.html` - HTML report
- `coverage/coverage-final.json` - JSON data

Current coverage:
```
File               | % Stmts | % Branch | % Funcs | % Lines
-------------------|---------|----------|---------|--------
All files          |   75.69 |    83.2  |   95.65 |   75.69
src/utils          |     100 |      100 |     100 |     100
src/services       |   89.62 |    83.47 |     100 |   89.62
```

## Test Configuration

Configuration is in `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    globalSetup: ['tests/globalSetup.ts'],
    globalTeardown: ['tests/globalTeardown.ts'],
    testTimeout: 30000,  // 30s for Docker operations
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
    },
  },
});
```

## Troubleshooting

### "close timed out after 10000ms"
This warning appears because the Express server keeps the process alive. It's harmless - tests still pass and cleanup occurs.

### Docker tests skipped
If Docker isn't available, Docker tests return early without failing:
```typescript
if (!dockerAvailable) return;
```

### Tests reading from wrong directory
The `mission-store` tests use dynamic imports with `vi.resetModules()` to ensure each test gets a fresh config pointing to the temp directory.

### Orphaned containers
If tests fail mid-run, containers may be left behind:
```bash
# Clean up manually
docker ps -aq --filter="label=haflow.mission_id" | xargs -r docker rm -f
```

## Adding New Tests

1. **Utils tests**: Add to `tests/unit/utils/` - no special setup needed
2. **Service tests**: Add to `tests/unit/services/` - use `getMissionStore()` pattern for config isolation
3. **Integration tests**: Add to `tests/integration/routes/` - use API calls, not direct store access
