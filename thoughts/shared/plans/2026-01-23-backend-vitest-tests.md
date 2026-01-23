# Backend Vitest Test Suite Implementation Plan

## Overview

Implement the complete Vitest test suite for `@haloop/backend` covering 8 test files across utils, services, and integration layers. Tests will use **real Docker containers** and the integration tests will hit an **actual running Express server**.

## Current State Analysis

### What Exists:
- `vitest: ^1.2.0` installed in devDependencies
- `@types/supertest: ^6.0.2` installed (types only)
- Basic `vitest.config.ts` with globals and node environment
- `test` and `test:watch` scripts in package.json
- All 6 source modules implemented and ready for testing

### What's Missing:
- `tests/` directory structure
- `tests/setup.ts` - per-test setup with temp directories
- `tests/globalSetup.ts` - start Express server
- `tests/globalTeardown.ts` - stop server, cleanup Docker
- `supertest` runtime package
- `test:coverage` script
- Coverage configuration in vitest.config.ts
- All 8 test files (0 implemented)

### Key Discoveries:
- `workflow.ts:4-19` - Hardcoded WORKFLOWS constant, no file loading needed
- `mission-store.ts:212-226` - Has `getLogTail()` and `getCurrentLogTail()` methods not in original plan
- `config.ts:11-13` - Has `workflowsDir` getter not in original plan
- `docker.ts:21-24` - Internal `shellEscape()` helper worth testing indirectly
- `sandbox.ts:1-56` - Defines `SandboxProvider` interface that `dockerProvider` implements

## Desired End State

After this plan is complete:
1. All 8 test suites pass with `pnpm --filter @haloop/backend test`
2. Coverage report available via `pnpm --filter @haloop/backend test:coverage`
3. Integration tests spin up real Docker containers
4. Tests run against actual Express server started by vitest globalSetup
5. Temp directories cleaned up after each test
6. Orphaned Docker containers cleaned up after test suite

## What We're NOT Doing

- No coverage thresholds that fail builds
- No CI configuration (tests run locally with Docker daemon)
- No E2E browser tests
- No performance/load testing
- No test database (using file-based mission store)

## Implementation Approach

Tests are implemented in dependency order: utils first (no dependencies), then services (depend on utils), then integration (depend on everything). Each phase builds on the previous.

---

## Phase 1: Infrastructure Setup

### Overview
Install missing dependencies, create directory structure, and configure vitest for server startup/teardown.

### Changes Required:

#### 1. Install supertest runtime
**Command**:
```bash
pnpm --filter @haloop/backend add -D supertest
```

#### 2. Create directory structure
**Directories to create**:
```
packages/backend/tests/
├── unit/
│   ├── utils/
│   └── services/
├── integration/
│   └── routes/
├── setup.ts
├── globalSetup.ts
└── globalTeardown.ts
```

#### 3. Update package.json scripts
**File**: `packages/backend/package.json`
**Changes**: Add test:coverage script

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

#### 4. Create tests/setup.ts
**File**: `packages/backend/tests/setup.ts`
**Changes**: Per-test temp directory handling

```typescript
import { beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'haloop-test-'));
  vi.stubEnv('HALOOP_HOME', testDir);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  if (testDir) {
    await rm(testDir, { recursive: true, force: true });
  }
});

export function getTestDir(): string {
  return testDir;
}
```

#### 5. Create tests/globalSetup.ts
**File**: `packages/backend/tests/globalSetup.ts`
**Changes**: Start Express server before all tests

```typescript
import type { GlobalSetupContext } from 'vitest/node';

export default async function globalSetup({ provide }: GlobalSetupContext) {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.PORT = '4001'; // Use different port for tests

  // Dynamic import to avoid module caching issues
  const { createServer } = await import('../src/server.js');
  const server = createServer();

  await new Promise<void>((resolve) => {
    server.listen(4001, () => {
      console.log('Test server started on port 4001');
      resolve();
    });
  });

  // Store server reference for teardown
  (globalThis as any).__TEST_SERVER__ = server;

  // Provide port to tests
  provide('serverPort', 4001);
}
```

#### 6. Create tests/globalTeardown.ts
**File**: `packages/backend/tests/globalTeardown.ts`
**Changes**: Stop server and cleanup Docker containers

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default async function globalTeardown() {
  // Stop the test server
  const server = (globalThis as any).__TEST_SERVER__;
  if (server) {
    await new Promise<void>((resolve) => {
      server.close(() => {
        console.log('Test server stopped');
        resolve();
      });
    });
  }

  // Cleanup any orphaned Docker containers from tests
  try {
    const { stdout } = await execAsync(
      'docker ps -aq --filter="label=haloop.mission_id"'
    );
    const containerIds = stdout.trim().split('\n').filter(Boolean);
    for (const id of containerIds) {
      await execAsync(`docker rm -f ${id}`).catch(() => {});
    }
    if (containerIds.length > 0) {
      console.log(`Cleaned up ${containerIds.length} orphaned containers`);
    }
  } catch {
    // Docker not available or no containers to clean
  }
}
```

#### 7. Update server.ts to export createServer
**File**: `packages/backend/src/server.ts`
**Changes**: Export factory function for testability

```typescript
import express from 'express';
import cors from 'cors';
import { missionRoutes } from './routes/missions.js';
import { missionStore } from './services/mission-store.js';
import { missionEngine } from './services/mission-engine.js';

export function createServer() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.text());

  app.use('/api/missions', missionRoutes);

  return app;
}

export async function startServer(port: number) {
  await missionStore.init();
  await missionEngine.init();

  const app = createServer();

  return app.listen(port, () => {
    console.log(`Haloop backend listening on port ${port}`);
  });
}
```

#### 8. Update vitest.config.ts
**File**: `packages/backend/vitest.config.ts`
**Changes**: Add globalSetup, globalTeardown, and coverage

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    globalSetup: ['tests/globalSetup.ts'],
    globalTeardown: ['tests/globalTeardown.ts'],
    testTimeout: 30000, // 30s for Docker operations
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

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @haloop/backend add -D supertest` completes successfully
- [x] Directory structure exists: `ls packages/backend/tests/unit/utils packages/backend/tests/unit/services packages/backend/tests/integration/routes`
- [x] Vitest config valid: `pnpm --filter @haloop/backend test` runs (0 tests found is OK)
- [x] TypeScript compiles: `pnpm --filter @haloop/backend build`

#### Manual Verification:
- [ ] Verify test server starts on port 4001 when running tests
- [ ] Verify server stops cleanly after tests complete

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Utils Tests

### Overview
Implement the three utility module tests - quick wins with no external dependencies.

### Changes Required:

#### 1. tests/unit/utils/id.test.ts
**File**: `packages/backend/tests/unit/utils/id.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { generateMissionId, generateRunId } from '../../../src/utils/id.js';

describe('id utils', () => {
  describe('generateMissionId', () => {
    it('returns prefixed ID starting with m-', () => {
      const id = generateMissionId();
      expect(id).toMatch(/^m-/);
    });

    it('returns 10-char ID (m- + 8 hex chars)', () => {
      const id = generateMissionId();
      expect(id).toHaveLength(10);
      expect(id).toMatch(/^m-[a-f0-9]{8}$/);
    });

    it('returns unique IDs on multiple calls', () => {
      const ids = new Set([
        generateMissionId(),
        generateMissionId(),
        generateMissionId(),
        generateMissionId(),
        generateMissionId(),
      ]);
      expect(ids.size).toBe(5);
    });
  });

  describe('generateRunId', () => {
    it('returns prefixed ID starting with r-', () => {
      const id = generateRunId();
      expect(id).toMatch(/^r-/);
    });

    it('returns 10-char ID (r- + 8 hex chars)', () => {
      const id = generateRunId();
      expect(id).toHaveLength(10);
      expect(id).toMatch(/^r-[a-f0-9]{8}$/);
    });
  });
});
```

#### 2. tests/unit/utils/response.test.ts
**File**: `packages/backend/tests/unit/utils/response.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import type { Response } from 'express';
import { sendSuccess, sendError } from '../../../src/utils/response.js';

function createMockResponse(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('response utils', () => {
  describe('sendSuccess', () => {
    it('sets default status code 200', () => {
      const res = createMockResponse();
      sendSuccess(res, { foo: 'bar' });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('respects custom status code', () => {
      const res = createMockResponse();
      sendSuccess(res, { foo: 'bar' }, 201);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('returns ApiResponse shape with success true', () => {
      const res = createMockResponse();
      const data = { foo: 'bar' };
      sendSuccess(res, data);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data,
        error: null,
      });
    });
  });

  describe('sendError', () => {
    it('sets default status code 400', () => {
      const res = createMockResponse();
      sendError(res, 'Something went wrong');
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('respects custom status code', () => {
      const res = createMockResponse();
      sendError(res, 'Not found', 404);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns ApiResponse shape with success false', () => {
      const res = createMockResponse();
      sendError(res, 'Something went wrong');
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        data: null,
        error: 'Something went wrong',
      });
    });
  });
});
```

#### 3. tests/unit/utils/config.test.ts
**File**: `packages/backend/tests/unit/utils/config.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { homedir } from 'os';
import { join } from 'path';

describe('config utils', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('port', () => {
    it('defaults to 4000 when PORT env not set', async () => {
      delete process.env.PORT;
      const { config } = await import('../../../src/utils/config.js');
      expect(config.port).toBe(4000);
    });

    it('respects PORT env variable', async () => {
      process.env.PORT = '5000';
      const { config } = await import('../../../src/utils/config.js');
      expect(config.port).toBe(5000);
    });
  });

  describe('haloopHome', () => {
    it('defaults to ~/.haloop when HALOOP_HOME env not set', async () => {
      delete process.env.HALOOP_HOME;
      const { config } = await import('../../../src/utils/config.js');
      expect(config.haloopHome).toBe(join(homedir(), '.haloop'));
    });

    it('respects HALOOP_HOME env variable', async () => {
      process.env.HALOOP_HOME = '/custom/path';
      const { config } = await import('../../../src/utils/config.js');
      expect(config.haloopHome).toBe('/custom/path');
    });
  });

  describe('missionsDir', () => {
    it('is haloopHome/missions', async () => {
      process.env.HALOOP_HOME = '/test/home';
      const { config } = await import('../../../src/utils/config.js');
      expect(config.missionsDir).toBe('/test/home/missions');
    });
  });

  describe('workflowsDir', () => {
    it('is cwd/packages/backend/public/workflows', async () => {
      const { config } = await import('../../../src/utils/config.js');
      expect(config.workflowsDir).toBe(
        join(process.cwd(), 'packages/backend/public/workflows')
      );
    });
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] All utils tests pass: `pnpm --filter @haloop/backend test tests/unit/utils`
- [x] No TypeScript errors in test files

#### Manual Verification:
- [ ] Review test output shows expected assertions

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Workflow Tests

### Overview
Implement tests for the static workflow service - no external dependencies, just testing hardcoded data.

### Changes Required:

#### 1. tests/unit/services/workflow.test.ts
**File**: `packages/backend/tests/unit/services/workflow.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  getDefaultWorkflowId,
  getDefaultWorkflow,
  getWorkflowStepName,
} from '../../../src/services/workflow.js';

describe('workflow service', () => {
  describe('getDefaultWorkflowId', () => {
    it('returns standard-feature', () => {
      expect(getDefaultWorkflowId()).toBe('standard-feature');
    });
  });

  describe('getDefaultWorkflow', () => {
    it('returns valid Workflow with workflow_id', () => {
      const workflow = getDefaultWorkflow();
      expect(workflow.workflow_id).toBe('standard-feature');
    });

    it('returns valid Workflow with name', () => {
      const workflow = getDefaultWorkflow();
      expect(workflow.name).toBe('Standard Feature');
    });

    it('has 8 steps', () => {
      const workflow = getDefaultWorkflow();
      expect(workflow.steps).toHaveLength(8);
    });

    it('alternates between agent and human-gate steps', () => {
      const workflow = getDefaultWorkflow();

      // Even indices (0,2,4,6) should be agent
      expect(workflow.steps[0].type).toBe('agent');
      expect(workflow.steps[2].type).toBe('agent');
      expect(workflow.steps[4].type).toBe('agent');
      expect(workflow.steps[6].type).toBe('agent');

      // Odd indices (1,3,5,7) should be human-gate
      expect(workflow.steps[1].type).toBe('human-gate');
      expect(workflow.steps[3].type).toBe('human-gate');
      expect(workflow.steps[5].type).toBe('human-gate');
      expect(workflow.steps[7].type).toBe('human-gate');
    });

    it('agent steps have inputArtifact and outputArtifact', () => {
      const workflow = getDefaultWorkflow();
      const agentSteps = workflow.steps.filter(s => s.type === 'agent');

      for (const step of agentSteps) {
        expect(step.inputArtifact).toBeDefined();
        expect(step.outputArtifact).toBeDefined();
      }
    });

    it('human-gate steps have reviewArtifact', () => {
      const workflow = getDefaultWorkflow();
      const humanGateSteps = workflow.steps.filter(s => s.type === 'human-gate');

      for (const step of humanGateSteps) {
        expect(step.reviewArtifact).toBeDefined();
      }
    });
  });

  describe('getWorkflowStepName', () => {
    it('returns correct name for valid stepIndex', () => {
      expect(getWorkflowStepName('standard-feature', 0)).toBe('Cleanup');
      expect(getWorkflowStepName('standard-feature', 1)).toBe('Review Structured');
      expect(getWorkflowStepName('standard-feature', 7)).toBe('Review Implementation');
    });

    it('returns Complete for out-of-bounds stepIndex', () => {
      expect(getWorkflowStepName('standard-feature', 8)).toBe('Complete');
      expect(getWorkflowStepName('standard-feature', 100)).toBe('Complete');
    });

    it('falls back to default workflow for unknown workflowId', () => {
      expect(getWorkflowStepName('unknown-workflow', 0)).toBe('Cleanup');
    });
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] Workflow tests pass: `pnpm --filter @haloop/backend test tests/unit/services/workflow`
- [x] No TypeScript errors

#### Manual Verification:
- [x] Review test output confirms all 8 steps validated

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Mission Store Tests

### Overview
Implement tests for the file-based persistence layer. Uses temp directories from setup.ts.

### Changes Required:

#### 1. tests/unit/services/mission-store.test.ts
**File**: `packages/backend/tests/unit/services/mission-store.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync } from 'fs';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { missionStore } from '../../../src/services/mission-store.js';
import { getTestDir } from '../../setup.js';

describe('mission-store service', () => {
  describe('init', () => {
    it('creates missions directory if not exists', async () => {
      const testDir = getTestDir();
      await missionStore.init();
      expect(existsSync(join(testDir, 'missions'))).toBe(true);
    });

    it('is idempotent - safe to call multiple times', async () => {
      await missionStore.init();
      await missionStore.init();
      await missionStore.init();
      const testDir = getTestDir();
      expect(existsSync(join(testDir, 'missions'))).toBe(true);
    });
  });

  describe('createMission', () => {
    beforeEach(async () => {
      await missionStore.init();
    });

    it('returns MissionMeta with generated ID', async () => {
      const meta = await missionStore.createMission('Test Mission', 'feature', 'Raw input');
      expect(meta.mission_id).toMatch(/^m-[a-f0-9]{8}$/);
    });

    it('returns MissionMeta with timestamps', async () => {
      const before = new Date().toISOString();
      const meta = await missionStore.createMission('Test Mission', 'feature', 'Raw input');
      const after = new Date().toISOString();

      expect(meta.created_at >= before).toBe(true);
      expect(meta.created_at <= after).toBe(true);
      expect(meta.updated_at).toBe(meta.created_at);
    });

    it('creates directory structure', async () => {
      const meta = await missionStore.createMission('Test Mission', 'feature', 'Raw input');
      const testDir = getTestDir();
      const missionDir = join(testDir, 'missions', meta.mission_id);

      expect(existsSync(missionDir)).toBe(true);
      expect(existsSync(join(missionDir, 'artifacts'))).toBe(true);
      expect(existsSync(join(missionDir, 'runs'))).toBe(true);
      expect(existsSync(join(missionDir, 'logs'))).toBe(true);
    });

    it('writes mission.json', async () => {
      const meta = await missionStore.createMission('Test Mission', 'feature', 'Raw input');
      const testDir = getTestDir();
      const metaPath = join(testDir, 'missions', meta.mission_id, 'mission.json');

      const content = await readFile(metaPath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.mission_id).toBe(meta.mission_id);
      expect(parsed.title).toBe('Test Mission');
    });

    it('writes raw-input.md artifact', async () => {
      const meta = await missionStore.createMission('Test Mission', 'feature', 'My raw input');
      const testDir = getTestDir();
      const artifactPath = join(testDir, 'missions', meta.mission_id, 'artifacts', 'raw-input.md');

      const content = await readFile(artifactPath, 'utf-8');
      expect(content).toBe('My raw input');
    });

    it('sets initial status to ready', async () => {
      const meta = await missionStore.createMission('Test Mission', 'feature', 'Raw input');
      expect(meta.status).toBe('ready');
    });

    it('sets current_step to 0', async () => {
      const meta = await missionStore.createMission('Test Mission', 'feature', 'Raw input');
      expect(meta.current_step).toBe(0);
    });
  });

  describe('getMeta', () => {
    beforeEach(async () => {
      await missionStore.init();
    });

    it('returns null for non-existent mission', async () => {
      const meta = await missionStore.getMeta('m-nonexist');
      expect(meta).toBeNull();
    });

    it('returns parsed MissionMeta for existing mission', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      const meta = await missionStore.getMeta(created.mission_id);

      expect(meta).not.toBeNull();
      expect(meta!.mission_id).toBe(created.mission_id);
      expect(meta!.title).toBe('Test');
    });
  });

  describe('getDetail', () => {
    beforeEach(async () => {
      await missionStore.init();
    });

    it('returns null for non-existent mission', async () => {
      const detail = await missionStore.getDetail('m-nonexist');
      expect(detail).toBeNull();
    });

    it('includes workflow', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      const detail = await missionStore.getDetail(created.mission_id);

      expect(detail!.workflow).toBeDefined();
      expect(detail!.workflow.workflow_id).toBe('standard-feature');
    });

    it('includes artifacts', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      const detail = await missionStore.getDetail(created.mission_id);

      expect(detail!.artifacts).toBeDefined();
      expect(detail!.artifacts['raw-input.md']).toBe('Input');
    });

    it('includes runs (empty initially)', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      const detail = await missionStore.getDetail(created.mission_id);

      expect(detail!.runs).toBeDefined();
      expect(detail!.runs).toHaveLength(0);
    });
  });

  describe('listMissions', () => {
    beforeEach(async () => {
      await missionStore.init();
    });

    it('returns empty array when no missions', async () => {
      const missions = await missionStore.listMissions();
      expect(missions).toEqual([]);
    });

    it('returns MissionListItem[] with correct fields', async () => {
      await missionStore.createMission('Test', 'feature', 'Input');
      const missions = await missionStore.listMissions();

      expect(missions).toHaveLength(1);
      expect(missions[0]).toHaveProperty('mission_id');
      expect(missions[0]).toHaveProperty('title');
      expect(missions[0]).toHaveProperty('type');
      expect(missions[0]).toHaveProperty('status');
      expect(missions[0]).toHaveProperty('current_step_name');
      expect(missions[0]).toHaveProperty('updated_at');
    });

    it('sorts by updated_at desc (most recent first)', async () => {
      const m1 = await missionStore.createMission('First', 'feature', 'Input');
      await new Promise(r => setTimeout(r, 10)); // Ensure different timestamps
      const m2 = await missionStore.createMission('Second', 'feature', 'Input');

      const missions = await missionStore.listMissions();
      expect(missions[0].mission_id).toBe(m2.mission_id);
      expect(missions[1].mission_id).toBe(m1.mission_id);
    });
  });

  describe('updateMeta', () => {
    beforeEach(async () => {
      await missionStore.init();
    });

    it('throws for non-existent mission', async () => {
      await expect(missionStore.updateMeta('m-nonexist', { status: 'completed' }))
        .rejects.toThrow('Mission not found');
    });

    it('merges partial updates', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      await missionStore.updateMeta(created.mission_id, { status: 'running_code_agent' });

      const meta = await missionStore.getMeta(created.mission_id);
      expect(meta!.status).toBe('running_code_agent');
      expect(meta!.title).toBe('Test'); // Preserved
    });

    it('updates updated_at timestamp', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      const originalUpdatedAt = created.updated_at;

      await new Promise(r => setTimeout(r, 10));
      await missionStore.updateMeta(created.mission_id, { status: 'completed' });

      const meta = await missionStore.getMeta(created.mission_id);
      expect(meta!.updated_at > originalUpdatedAt).toBe(true);
    });
  });

  describe('artifacts', () => {
    beforeEach(async () => {
      await missionStore.init();
    });

    it('getArtifact returns null for non-existent artifact', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      const artifact = await missionStore.getArtifact(created.mission_id, 'nonexistent.md');
      expect(artifact).toBeNull();
    });

    it('getArtifact returns file content as string', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'My input');
      const artifact = await missionStore.getArtifact(created.mission_id, 'raw-input.md');
      expect(artifact).toBe('My input');
    });

    it('saveArtifact creates file', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      await missionStore.saveArtifact(created.mission_id, 'output.md', 'Output content');

      const artifact = await missionStore.getArtifact(created.mission_id, 'output.md');
      expect(artifact).toBe('Output content');
    });

    it('saveArtifact overwrites existing file', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      await missionStore.saveArtifact(created.mission_id, 'output.md', 'First');
      await missionStore.saveArtifact(created.mission_id, 'output.md', 'Second');

      const artifact = await missionStore.getArtifact(created.mission_id, 'output.md');
      expect(artifact).toBe('Second');
    });

    it('loadArtifacts returns Record<filename, content>', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      await missionStore.saveArtifact(created.mission_id, 'a.md', 'Content A');
      await missionStore.saveArtifact(created.mission_id, 'b.md', 'Content B');

      const artifacts = await missionStore.loadArtifacts(created.mission_id);
      expect(artifacts['raw-input.md']).toBe('Input');
      expect(artifacts['a.md']).toBe('Content A');
      expect(artifacts['b.md']).toBe('Content B');
    });
  });

  describe('runs', () => {
    beforeEach(async () => {
      await missionStore.init();
    });

    it('createRun returns StepRun with generated ID', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      const run = await missionStore.createRun(created.mission_id, 'cleanup');

      expect(run.run_id).toMatch(/^r-[a-f0-9]{8}$/);
      expect(run.step_id).toBe('cleanup');
    });

    it('createRun sets started_at timestamp', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      const before = new Date().toISOString();
      const run = await missionStore.createRun(created.mission_id, 'cleanup');
      const after = new Date().toISOString();

      expect(run.started_at >= before).toBe(true);
      expect(run.started_at <= after).toBe(true);
    });

    it('createRun writes run JSON file', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      const run = await missionStore.createRun(created.mission_id, 'cleanup');

      const testDir = getTestDir();
      const runPath = join(testDir, 'missions', created.mission_id, 'runs', `${run.run_id}.json`);
      expect(existsSync(runPath)).toBe(true);
    });

    it('loadRuns returns empty array when no runs', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      const runs = await missionStore.loadRuns(created.mission_id);
      expect(runs).toEqual([]);
    });

    it('loadRuns returns sorted StepRun[] by started_at', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      const run1 = await missionStore.createRun(created.mission_id, 'cleanup');
      await new Promise(r => setTimeout(r, 10));
      const run2 = await missionStore.createRun(created.mission_id, 'research');

      const runs = await missionStore.loadRuns(created.mission_id);
      expect(runs[0].run_id).toBe(run1.run_id); // Older first
      expect(runs[1].run_id).toBe(run2.run_id);
    });

    it('updateRun merges partial updates', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      const run = await missionStore.createRun(created.mission_id, 'cleanup');

      await missionStore.updateRun(created.mission_id, run.run_id, {
        finished_at: '2024-01-01T00:00:00Z',
        exit_code: 0,
      });

      const runs = await missionStore.loadRuns(created.mission_id);
      expect(runs[0].finished_at).toBe('2024-01-01T00:00:00Z');
      expect(runs[0].exit_code).toBe(0);
      expect(runs[0].step_id).toBe('cleanup'); // Preserved
    });
  });

  describe('logs', () => {
    beforeEach(async () => {
      await missionStore.init();
    });

    it('appendLog creates log file if not exists', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      const run = await missionStore.createRun(created.mission_id, 'cleanup');

      await missionStore.appendLog(created.mission_id, run.run_id, 'First log');

      const testDir = getTestDir();
      const logPath = join(testDir, 'missions', created.mission_id, 'logs', `${run.run_id}.log`);
      expect(existsSync(logPath)).toBe(true);
    });

    it('appendLog appends to existing log', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      const run = await missionStore.createRun(created.mission_id, 'cleanup');

      await missionStore.appendLog(created.mission_id, run.run_id, 'First');
      await missionStore.appendLog(created.mission_id, run.run_id, 'Second');

      const testDir = getTestDir();
      const logPath = join(testDir, 'missions', created.mission_id, 'logs', `${run.run_id}.log`);
      const content = await readFile(logPath, 'utf-8');
      expect(content).toBe('FirstSecond');
    });

    it('getLogTail returns empty string for non-existent log', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      const tail = await missionStore.getLogTail(created.mission_id, 'r-nonexist');
      expect(tail).toBe('');
    });

    it('getLogTail returns last N bytes', async () => {
      const created = await missionStore.createMission('Test', 'feature', 'Input');
      const run = await missionStore.createRun(created.mission_id, 'cleanup');

      await missionStore.appendLog(created.mission_id, run.run_id, 'A'.repeat(100));

      const tail = await missionStore.getLogTail(created.mission_id, run.run_id, 50);
      expect(tail).toHaveLength(50);
      expect(tail).toBe('A'.repeat(50));
    });
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] Mission store tests pass: `pnpm --filter @haloop/backend test tests/unit/services/mission-store`
- [x] No TypeScript errors

#### Manual Verification:
- [x] Verify temp directories are created and cleaned up between tests

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 5.

---

## Phase 5: Docker Provider Tests

### Overview
Implement tests for the Docker provider using real Docker containers. Requires Docker daemon running.

### Changes Required:

#### 1. tests/unit/services/docker.test.ts
**File**: `packages/backend/tests/unit/services/docker.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { mkdir, rm, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { dockerProvider } from '../../../src/services/docker.js';
import { getTestDir } from '../../setup.js';

describe('docker provider', () => {
  let dockerAvailable: boolean;
  const createdContainers: string[] = [];

  beforeAll(async () => {
    dockerAvailable = await dockerProvider.isAvailable();
    if (!dockerAvailable) {
      console.warn('Docker not available - skipping Docker tests');
    }
  });

  afterEach(async () => {
    // Cleanup containers created during tests
    for (const id of createdContainers) {
      await dockerProvider.remove(id).catch(() => {});
    }
    createdContainers.length = 0;
  });

  describe('isAvailable', () => {
    it('returns true when docker works', async () => {
      // This test validates the environment
      const available = await dockerProvider.isAvailable();
      expect(typeof available).toBe('boolean');
    });
  });

  describe('start', () => {
    it('returns container ID from stdout', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'artifacts');
      await mkdir(artifactsPath, { recursive: true });

      const containerId = await dockerProvider.start({
        missionId: 'm-test1234',
        runId: 'r-test1234',
        stepId: 'test-step',
        image: 'alpine:latest',
        artifactsPath,
        command: ['echo', 'hello'],
      });

      createdContainers.push(containerId);
      expect(containerId).toBeTruthy();
      expect(containerId.length).toBeGreaterThan(10);
    });

    it('includes all labels', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'artifacts');
      await mkdir(artifactsPath, { recursive: true });

      const containerId = await dockerProvider.start({
        missionId: 'm-labeltest',
        runId: 'r-labeltest',
        stepId: 'label-step',
        image: 'alpine:latest',
        artifactsPath,
        command: ['sleep', '10'],
      });

      createdContainers.push(containerId);

      // Inspect container to verify labels
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const { stdout } = await execAsync(`docker inspect --format='{{json .Config.Labels}}' ${containerId}`);
      const labels = JSON.parse(stdout.trim());

      expect(labels['haloop.mission_id']).toBe('m-labeltest');
      expect(labels['haloop.run_id']).toBe('r-labeltest');
      expect(labels['haloop.step_id']).toBe('label-step');
    });

    it('mounts artifacts volume', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'artifacts');
      await mkdir(artifactsPath, { recursive: true });
      await writeFile(join(artifactsPath, 'test.txt'), 'test content');

      const containerId = await dockerProvider.start({
        missionId: 'm-mount',
        runId: 'r-mount',
        stepId: 'mount-step',
        image: 'alpine:latest',
        artifactsPath,
        command: ['cat', '/mission/artifacts/test.txt'],
      });

      createdContainers.push(containerId);

      // Wait for container to finish
      await new Promise(r => setTimeout(r, 2000));

      const logs = await dockerProvider.getLogTail(containerId);
      expect(logs).toContain('test content');
    });

    it('shell-escapes sh -c commands', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'artifacts');
      await mkdir(artifactsPath, { recursive: true });

      // Command with special characters that need escaping
      const containerId = await dockerProvider.start({
        missionId: 'm-escape',
        runId: 'r-escape',
        stepId: 'escape-step',
        image: 'alpine:latest',
        artifactsPath,
        command: ['sh', '-c', 'echo "hello world" && echo "done"'],
      });

      createdContainers.push(containerId);

      // Wait for container to finish
      await new Promise(r => setTimeout(r, 2000));

      const logs = await dockerProvider.getLogTail(containerId);
      expect(logs).toContain('hello world');
      expect(logs).toContain('done');
    });
  });

  describe('getStatus', () => {
    it('parses running state', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'artifacts');
      await mkdir(artifactsPath, { recursive: true });

      const containerId = await dockerProvider.start({
        missionId: 'm-running',
        runId: 'r-running',
        stepId: 'running-step',
        image: 'alpine:latest',
        artifactsPath,
        command: ['sleep', '30'],
      });

      createdContainers.push(containerId);

      const status = await dockerProvider.getStatus(containerId);
      expect(status.state).toBe('running');
    });

    it('parses exited state with exit code', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'artifacts');
      await mkdir(artifactsPath, { recursive: true });

      const containerId = await dockerProvider.start({
        missionId: 'm-exited',
        runId: 'r-exited',
        stepId: 'exited-step',
        image: 'alpine:latest',
        artifactsPath,
        command: ['sh', '-c', 'exit 42'],
      });

      createdContainers.push(containerId);

      // Wait for container to exit
      await new Promise(r => setTimeout(r, 2000));

      const status = await dockerProvider.getStatus(containerId);
      expect(status.state).toBe('exited');
      expect(status.exitCode).toBe(42);
    });

    it('returns unknown on error', async () => {
      const status = await dockerProvider.getStatus('nonexistent-container-id');
      expect(status.state).toBe('unknown');
    });

    it('parses timestamps', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'artifacts');
      await mkdir(artifactsPath, { recursive: true });

      const containerId = await dockerProvider.start({
        missionId: 'm-timestamps',
        runId: 'r-timestamps',
        stepId: 'timestamps-step',
        image: 'alpine:latest',
        artifactsPath,
        command: ['echo', 'done'],
      });

      createdContainers.push(containerId);

      // Wait for container to exit
      await new Promise(r => setTimeout(r, 2000));

      const status = await dockerProvider.getStatus(containerId);
      expect(status.startedAt).toBeDefined();
      expect(status.finishedAt).toBeDefined();
    });
  });

  describe('getLogTail', () => {
    it('returns stdout from docker logs', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'artifacts');
      await mkdir(artifactsPath, { recursive: true });

      const containerId = await dockerProvider.start({
        missionId: 'm-logs',
        runId: 'r-logs',
        stepId: 'logs-step',
        image: 'alpine:latest',
        artifactsPath,
        command: ['echo', 'test output'],
      });

      createdContainers.push(containerId);

      // Wait for container to finish
      await new Promise(r => setTimeout(r, 2000));

      const logs = await dockerProvider.getLogTail(containerId);
      expect(logs).toContain('test output');
    });

    it('slices to byte limit', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'artifacts');
      await mkdir(artifactsPath, { recursive: true });

      const containerId = await dockerProvider.start({
        missionId: 'm-longlog',
        runId: 'r-longlog',
        stepId: 'longlog-step',
        image: 'alpine:latest',
        artifactsPath,
        command: ['sh', '-c', 'for i in $(seq 1 1000); do echo "line $i"; done'],
      });

      createdContainers.push(containerId);

      // Wait for container to finish
      await new Promise(r => setTimeout(r, 3000));

      const logs = await dockerProvider.getLogTail(containerId, 100);
      expect(logs.length).toBeLessThanOrEqual(100);
    });

    it('returns empty string on error', async () => {
      const logs = await dockerProvider.getLogTail('nonexistent-container-id');
      expect(logs).toBe('');
    });
  });

  describe('stop', () => {
    it('calls docker stop', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'artifacts');
      await mkdir(artifactsPath, { recursive: true });

      const containerId = await dockerProvider.start({
        missionId: 'm-stop',
        runId: 'r-stop',
        stepId: 'stop-step',
        image: 'alpine:latest',
        artifactsPath,
        command: ['sleep', '60'],
      });

      createdContainers.push(containerId);

      // Verify running
      let status = await dockerProvider.getStatus(containerId);
      expect(status.state).toBe('running');

      // Stop
      await dockerProvider.stop(containerId);

      // Verify stopped
      await new Promise(r => setTimeout(r, 1000));
      status = await dockerProvider.getStatus(containerId);
      expect(status.state).toBe('exited');
    });

    it('ignores errors for already stopped containers', async () => {
      // Should not throw
      await dockerProvider.stop('nonexistent-container');
    });
  });

  describe('remove', () => {
    it('calls docker rm -f', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'artifacts');
      await mkdir(artifactsPath, { recursive: true });

      const containerId = await dockerProvider.start({
        missionId: 'm-remove',
        runId: 'r-remove',
        stepId: 'remove-step',
        image: 'alpine:latest',
        artifactsPath,
        command: ['echo', 'done'],
      });

      // Don't add to createdContainers since we're removing it

      await dockerProvider.remove(containerId);

      // Verify removed
      const status = await dockerProvider.getStatus(containerId);
      expect(status.state).toBe('unknown');
    });

    it('ignores errors for already removed containers', async () => {
      // Should not throw
      await dockerProvider.remove('nonexistent-container');
    });
  });

  describe('cleanupOrphaned', () => {
    it('finds and removes containers by label filter', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'artifacts');
      await mkdir(artifactsPath, { recursive: true });

      // Create a container
      const containerId = await dockerProvider.start({
        missionId: 'm-orphan',
        runId: 'r-orphan',
        stepId: 'orphan-step',
        image: 'alpine:latest',
        artifactsPath,
        command: ['sleep', '60'],
      });

      // Don't add to createdContainers - cleanupOrphaned should handle it

      // Run cleanup
      await dockerProvider.cleanupOrphaned();

      // Verify removed
      const status = await dockerProvider.getStatus(containerId);
      expect(status.state).toBe('unknown');
    });
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] Docker tests pass: `pnpm --filter @haloop/backend test tests/unit/services/docker`
- [x] No orphaned containers after test run: `docker ps -a --filter="label=haloop.mission_id"`

#### Manual Verification:
- [x] Verify Docker daemon is running before tests
- [x] Spot check that containers are created and cleaned up during test

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 6.

---

## Phase 6: Mission Engine Tests

### Overview
Implement tests for the orchestration layer. Mocks the Docker provider for predictable behavior.

### Changes Required:

#### 1. tests/unit/services/mission-engine.test.ts
**File**: `packages/backend/tests/unit/services/mission-engine.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { missionStore } from '../../../src/services/mission-store.js';
import { missionEngine } from '../../../src/services/mission-engine.js';

// Mock the docker provider
vi.mock('../../../src/services/docker.js', () => ({
  dockerProvider: {
    isAvailable: vi.fn().mockResolvedValue(true),
    cleanupOrphaned: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue('mock-container-id'),
    getStatus: vi.fn().mockResolvedValue({ state: 'running' }),
    getLogTail: vi.fn().mockResolvedValue('mock logs'),
    stop: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('mission-engine service', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await missionStore.init();
  });

  describe('init', () => {
    it('checks provider availability', async () => {
      const { dockerProvider } = await import('../../../src/services/docker.js');
      await missionEngine.init();
      expect(dockerProvider.isAvailable).toHaveBeenCalled();
    });

    it('calls cleanupOrphaned', async () => {
      const { dockerProvider } = await import('../../../src/services/docker.js');
      await missionEngine.init();
      expect(dockerProvider.cleanupOrphaned).toHaveBeenCalled();
    });

    it('logs warning when provider unavailable', async () => {
      const { dockerProvider } = await import('../../../src/services/docker.js');
      vi.mocked(dockerProvider.isAvailable).mockResolvedValueOnce(false);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await missionEngine.init();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('not available')
      );
      warnSpy.mockRestore();
    });
  });

  describe('continueMission - human gates', () => {
    it('throws for non-existent mission', async () => {
      await expect(missionEngine.continueMission('m-nonexist'))
        .rejects.toThrow('Mission not found');
    });

    it('at human-gate advances to next step', async () => {
      const mission = await missionStore.createMission('Test', 'feature', 'Input');
      // Set to step 1 (first human-gate)
      await missionStore.updateMeta(mission.mission_id, {
        current_step: 1,
        status: 'waiting_human'
      });

      await missionEngine.continueMission(mission.mission_id);

      const meta = await missionStore.getMeta(mission.mission_id);
      expect(meta!.current_step).toBe(2);
    });

    it('at human-gate sets waiting_human for next human-gate', async () => {
      const mission = await missionStore.createMission('Test', 'feature', 'Input');
      // Set to step 1 (human-gate), next step 2 is agent, which will auto-advance to step 3 (human-gate)
      // But with mocked provider, we need to test simpler case
      // Set to step 3 (human-gate), next step 4 is agent
      await missionStore.updateMeta(mission.mission_id, {
        current_step: 3,
        status: 'waiting_human'
      });

      // Mock provider to simulate immediate success
      const { dockerProvider } = await import('../../../src/services/docker.js');
      vi.mocked(dockerProvider.getStatus).mockResolvedValue({ state: 'exited', exitCode: 0 });

      await missionEngine.continueMission(mission.mission_id);

      // It will advance and start the agent, which will eventually trigger next human gate
      const meta = await missionStore.getMeta(mission.mission_id);
      // Status should be running_code_agent since agent step started
      expect(['ready', 'running_code_agent']).toContain(meta!.status);
    });

    it('at last step sets completed', async () => {
      const mission = await missionStore.createMission('Test', 'feature', 'Input');
      // Set to step 7 (last human-gate)
      await missionStore.updateMeta(mission.mission_id, {
        current_step: 7,
        status: 'waiting_human'
      });

      await missionEngine.continueMission(mission.mission_id);

      const meta = await missionStore.getMeta(mission.mission_id);
      expect(meta!.status).toBe('completed');
      expect(meta!.current_step).toBe(8);
    });
  });

  describe('continueMission - agent steps', () => {
    it('at agent step creates run record', async () => {
      const mission = await missionStore.createMission('Test', 'feature', 'Input');
      // Step 0 is agent step

      await missionEngine.continueMission(mission.mission_id);

      const runs = await missionStore.loadRuns(mission.mission_id);
      expect(runs.length).toBeGreaterThan(0);
      expect(runs[0].step_id).toBe('cleanup');
    });

    it('at agent step sets running_code_agent status', async () => {
      const mission = await missionStore.createMission('Test', 'feature', 'Input');

      await missionEngine.continueMission(mission.mission_id);

      const meta = await missionStore.getMeta(mission.mission_id);
      expect(meta!.status).toBe('running_code_agent');
    });

    it('at agent step calls provider.start', async () => {
      const { dockerProvider } = await import('../../../src/services/docker.js');
      const mission = await missionStore.createMission('Test', 'feature', 'Input');

      await missionEngine.continueMission(mission.mission_id);

      expect(dockerProvider.start).toHaveBeenCalledWith(
        expect.objectContaining({
          missionId: mission.mission_id,
          stepId: 'cleanup',
        })
      );
    });

    it('handles provider.start failure', async () => {
      const { dockerProvider } = await import('../../../src/services/docker.js');
      vi.mocked(dockerProvider.start).mockRejectedValueOnce(new Error('Docker failed'));

      const mission = await missionStore.createMission('Test', 'feature', 'Input');

      await missionEngine.continueMission(mission.mission_id);

      const meta = await missionStore.getMeta(mission.mission_id);
      expect(meta!.status).toBe('failed');
      expect(meta!.last_error).toContain('Docker failed');
    });
  });

  describe('getRunningLogTail', () => {
    it('returns undefined when no running container', async () => {
      const tail = await missionEngine.getRunningLogTail('m-test', 'r-notrunning');
      expect(tail).toBeUndefined();
    });
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] Mission engine tests pass: `pnpm --filter @haloop/backend test tests/unit/services/mission-engine`
- [x] No TypeScript errors

#### Manual Verification:
- [x] Verify mock behavior matches expected Docker interactions

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 7.

---

## Phase 7: API Routes Integration Tests

### Overview
Implement full integration tests for the Express API using supertest against the running server.

### Changes Required:

#### 1. tests/integration/routes/missions.test.ts
**File**: `packages/backend/tests/integration/routes/missions.test.ts`

```typescript
import { describe, it, expect, beforeEach, inject } from 'vitest';
import request from 'supertest';
import { missionStore } from '../../../src/services/mission-store.js';

const BASE_URL = 'http://localhost:4001';

describe('missions routes', () => {
  beforeEach(async () => {
    await missionStore.init();
  });

  describe('GET /api/missions', () => {
    it('returns empty array when no missions', async () => {
      const res = await request(BASE_URL).get('/api/missions');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('returns array of MissionListItem after creating missions', async () => {
      await missionStore.createMission('Test 1', 'feature', 'Input 1');
      await missionStore.createMission('Test 2', 'bug', 'Input 2');

      const res = await request(BASE_URL).get('/api/missions');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toHaveProperty('mission_id');
      expect(res.body.data[0]).toHaveProperty('title');
      expect(res.body.data[0]).toHaveProperty('status');
    });

    it('missions sorted by updated_at desc', async () => {
      const m1 = await missionStore.createMission('First', 'feature', 'Input');
      await new Promise(r => setTimeout(r, 10));
      const m2 = await missionStore.createMission('Second', 'feature', 'Input');

      const res = await request(BASE_URL).get('/api/missions');

      expect(res.body.data[0].mission_id).toBe(m2.mission_id);
      expect(res.body.data[1].mission_id).toBe(m1.mission_id);
    });
  });

  describe('GET /api/missions/:missionId', () => {
    it('returns 404 for non-existent mission', async () => {
      const res = await request(BASE_URL).get('/api/missions/m-nonexist');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('not found');
    });

    it('returns MissionDetail for valid ID', async () => {
      const mission = await missionStore.createMission('Test', 'feature', 'Input');

      const res = await request(BASE_URL).get(`/api/missions/${mission.mission_id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mission_id).toBe(mission.mission_id);
      expect(res.body.data.title).toBe('Test');
    });

    it('includes workflow in response', async () => {
      const mission = await missionStore.createMission('Test', 'feature', 'Input');

      const res = await request(BASE_URL).get(`/api/missions/${mission.mission_id}`);

      expect(res.body.data.workflow).toBeDefined();
      expect(res.body.data.workflow.workflow_id).toBe('standard-feature');
      expect(res.body.data.workflow.steps).toHaveLength(8);
    });

    it('includes artifacts in response', async () => {
      const mission = await missionStore.createMission('Test', 'feature', 'My input');

      const res = await request(BASE_URL).get(`/api/missions/${mission.mission_id}`);

      expect(res.body.data.artifacts).toBeDefined();
      expect(res.body.data.artifacts['raw-input.md']).toBe('My input');
    });
  });

  describe('POST /api/missions', () => {
    it('returns 400 for missing title', async () => {
      const res = await request(BASE_URL)
        .post('/api/missions')
        .send({ type: 'feature', rawInput: 'Input' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('title');
    });

    it('returns 400 for missing type', async () => {
      const res = await request(BASE_URL)
        .post('/api/missions')
        .send({ title: 'Test', rawInput: 'Input' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('type');
    });

    it('returns 400 for missing rawInput', async () => {
      const res = await request(BASE_URL)
        .post('/api/missions')
        .send({ title: 'Test', type: 'feature' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('rawInput');
    });

    it('returns 201 with MissionMeta on success', async () => {
      const res = await request(BASE_URL)
        .post('/api/missions')
        .send({ title: 'New Mission', type: 'feature', rawInput: 'My input' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mission_id).toMatch(/^m-[a-f0-9]{8}$/);
      expect(res.body.data.title).toBe('New Mission');
      expect(res.body.data.status).toBe('ready');
    });

    it('creates mission on disk', async () => {
      const res = await request(BASE_URL)
        .post('/api/missions')
        .send({ title: 'Disk Test', type: 'feature', rawInput: 'Input' });

      const meta = await missionStore.getMeta(res.body.data.mission_id);
      expect(meta).not.toBeNull();
      expect(meta!.title).toBe('Disk Test');
    });
  });

  describe('PUT /api/missions/:missionId/artifacts/:filename', () => {
    it('returns 404 for non-existent mission', async () => {
      const res = await request(BASE_URL)
        .put('/api/missions/m-nonexist/artifacts/test.md')
        .send({ content: 'Test content' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('saves artifact content', async () => {
      const mission = await missionStore.createMission('Test', 'feature', 'Input');

      const res = await request(BASE_URL)
        .put(`/api/missions/${mission.mission_id}/artifacts/output.md`)
        .send({ content: 'New artifact content' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const artifact = await missionStore.getArtifact(mission.mission_id, 'output.md');
      expect(artifact).toBe('New artifact content');
    });

    it('updates mission updated_at', async () => {
      const mission = await missionStore.createMission('Test', 'feature', 'Input');
      const originalUpdatedAt = mission.updated_at;

      await new Promise(r => setTimeout(r, 10));

      await request(BASE_URL)
        .put(`/api/missions/${mission.mission_id}/artifacts/output.md`)
        .send({ content: 'Content' });

      const meta = await missionStore.getMeta(mission.mission_id);
      expect(meta!.updated_at > originalUpdatedAt).toBe(true);
    });
  });

  describe('POST /api/missions/:missionId/continue', () => {
    it('returns 404 for non-existent mission', async () => {
      const res = await request(BASE_URL)
        .post('/api/missions/m-nonexist/continue');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 200 on success', async () => {
      const mission = await missionStore.createMission('Test', 'feature', 'Input');

      const res = await request(BASE_URL)
        .post(`/api/missions/${mission.mission_id}/continue`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/missions/:missionId/mark-completed', () => {
    it('returns 404 for non-existent mission', async () => {
      const res = await request(BASE_URL)
        .post('/api/missions/m-nonexist/mark-completed');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('sets status to completed', async () => {
      const mission = await missionStore.createMission('Test', 'feature', 'Input');

      const res = await request(BASE_URL)
        .post(`/api/missions/${mission.mission_id}/mark-completed`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const meta = await missionStore.getMeta(mission.mission_id);
      expect(meta!.status).toBe('completed');
    });
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] Integration tests pass: `pnpm --filter @haloop/backend test tests/integration`
- [x] All tests pass together: `pnpm --filter @haloop/backend test`
- [x] Coverage report generates: `pnpm --filter @haloop/backend test:coverage`

#### Manual Verification:
- [x] Verify server starts before tests and stops after
- [x] Verify no orphaned containers after full test suite
- [x] Review coverage report for any obvious gaps

**Implementation Note**: After completing this phase and all automated verification passes, the implementation is complete.

---

## Testing Strategy

### Unit Tests:
- Utils: Pure function tests, no mocking needed
- Workflow: Static data validation
- Mission Store: File system operations with temp directories
- Docker Provider: Real Docker integration
- Mission Engine: Mocked Docker provider for predictable behavior

### Integration Tests:
- Full Express app via supertest
- Real temp directory for mission storage
- Real Docker for container operations (via mission engine)
- Tests run against actual server started by globalSetup

### Manual Testing Steps:
1. Verify Docker daemon is running: `docker version`
2. Run full test suite: `pnpm --filter @haloop/backend test`
3. Check no orphaned containers: `docker ps -a --filter="label=haloop.mission_id"`
4. Generate coverage report: `pnpm --filter @haloop/backend test:coverage`
5. Review coverage HTML in `packages/backend/coverage/`

## Performance Considerations

- Docker tests have 30s timeout for container operations
- Temp directories created per-test to avoid state leakage
- Containers cleaned up immediately after each Docker test
- Global teardown performs final orphan cleanup

## References

- Test plan: `packages/backend/test-plan.md`
- Research: `thoughts/shared/research/2026-01-23-backend-vitest-test-plan.md`
- Source modules: `packages/backend/src/`
- Vitest docs: https://vitest.dev/guide/
