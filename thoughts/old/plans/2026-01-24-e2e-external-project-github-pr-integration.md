---
date: 2026-01-24T19:30:00+02:00
researcher: Claude Opus 4.5
git_commit: 8af8ad782a1de96c8f52943c9757f8ee37e25bf8
branch: main
repository: haflow
topic: "E2E Testing for External Project & GitHub PR Integration"
tags: [research, e2e, testing, playwright, docker, github, pr]
status: complete
last_updated: 2026-01-24
last_updated_by: Claude Opus 4.5
---

# Research: E2E Testing for External Project & GitHub PR Integration

**Date**: 2026-01-24T19:30:00+02:00
**Researcher**: Claude Opus 4.5
**Git Commit**: 8af8ad782a1de96c8f52943c9757f8ee37e25bf8
**Branch**: main
**Repository**: haflow

## Research Question

How to create E2E testing for the external project GitHub PR integration feature, specifically for NON-CI testing since Docker is required?

## Summary

The Haflow codebase has two testing frameworks:
1. **Backend (Vitest)**: Unit tests with mocked Docker, integration tests with real Docker (skipped in CI)
2. **Frontend (Playwright)**: E2E tests that run the full stack

For the external project GitHub PR integration, E2E tests should:
- Use Playwright with the existing frontend test infrastructure
- Create a test git repository fixture similar to `packages/backend/tests/resource/vue-frontend/`
- Skip in CI using `test.skip(!!process.env.CI)` pattern
- Test the complete flow: project linking → mission creation → branch creation → PR creation → frontend display

## Detailed Findings

### Existing Testing Infrastructure

#### Frontend E2E Tests (Playwright)

**Location**: `packages/frontend/tests/e2e/`

**Configuration**: `packages/frontend/playwright.config.ts`
- Base URL: `http://localhost:5173`
- Single worker, no parallel execution
- 30s test timeout, 10s expect timeout
- Auto-starts both backend (port 4000) and frontend (port 5173) servers
- Global setup/teardown handles test directory and Docker cleanup

**Test Environment**: `packages/frontend/tests/e2e-env.ts`
- Creates isolated `HAFLOW_HOME` directory per test run
- CI uses fixed path `/tmp/haflow-e2e/ci-run`
- Local runs get unique temp directory

**Docker Cleanup**: `packages/frontend/tests/globalTeardown.ts`
- Cleans up containers by `haflow.mission_id` label
- Removes test directory after tests complete

#### Backend Integration Tests (Vitest)

**Location**: `packages/backend/tests/integration/docker/`

**Key Patterns**:
1. **CI Skip Pattern**:
```typescript
const skipInCi = Boolean(process.env.CI);
it.skipIf(skipInCi)('test name', async () => { ... }, 60000);
```

2. **Docker Availability Check**:
```typescript
let dockerAvailable: boolean;
beforeAll(async () => {
  dockerAvailable = await dockerProvider.isAvailable();
});
it('test', async () => {
  if (!dockerAvailable) return;
  // test logic
});
```

3. **Container Tracking**:
```typescript
const createdContainers: string[] = [];
afterEach(async () => {
  for (const id of createdContainers) {
    await dockerProvider.remove(id).catch(() => {});
  }
});
```

### What Needs Testing for External Project GitHub PR Integration

Based on the implementation plan (`thoughts/shared/plans/2026-01-24-external-project-github-pr-integration.md`):

| Phase | Feature | What to Test |
|-------|---------|--------------|
| Phase 1 | CLI Config Reading | Mission has `project_path` and `branch_name` after creation |
| Phase 2 | Project Mount | Container has project files at `/workspace` |
| Phase 3 | Git Branch | Branch `haflow/{mission-id}` exists in test repo |
| Phase 4 | PR Creation | PR URL stored in mission metadata |
| Phase 5 | Frontend Display | PR link and changed files tree visible |

### Recommended Test Structure

#### 1. Test Fixture: Git Repository

Create a minimal test git repository at:
`packages/frontend/tests/resource/test-git-project/`

```
test-git-project/
├── .git/                    # Initialized git repo
├── package.json             # Minimal project
├── src/
│   └── index.ts             # Source file for agent to modify
└── README.md
```

**Setup Requirements**:
- Initialize with `git init`
- Create initial commit on `main` branch
- Configure a remote (can be a GitHub repo or local bare repo)
- SSH keys or `gh auth` needed for push/PR operations

#### 2. E2E Test File Structure

Create: `packages/frontend/tests/e2e/github-pr-integration.test.ts`

```typescript
import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { existsSync, writeFileSync } from 'fs';

const execAsync = promisify(exec);
const skipInCi = !!process.env.CI;

// Path to test fixture
const TEST_PROJECT_PATH = join(__dirname, '../resource/test-git-project');

test.describe('External Project GitHub PR Integration', () => {
  test.skip(skipInCi, 'Requires Docker and real git operations');

  test.beforeAll(async () => {
    // Verify test project exists and is a git repo
    expect(existsSync(join(TEST_PROJECT_PATH, '.git'))).toBe(true);

    // Verify gh CLI is authenticated
    const { stdout } = await execAsync('gh auth status');
    expect(stdout).toContain('Logged in');
  });

  test.beforeEach(async () => {
    // Link the test project via CLI config
    // Write directly to HAFLOW_HOME config.json
    const configPath = join(process.env.HAFLOW_HOME!, 'config.json');
    writeFileSync(configPath, JSON.stringify({ linkedProject: TEST_PROJECT_PATH }));
  });

  test('mission created with linked project has project_path and branch_name', async ({ page, request }) => {
    // Create mission via UI
    await page.goto('/');
    await page.click('[data-testid="new-mission-button"]');
    await page.fill('[data-testid="mission-title-input"]', 'Test PR Integration');
    await page.fill('[data-testid="mission-raw-input"]', 'Make a small change');
    await page.click('[data-testid="create-mission-button"]');

    // Verify API response includes project fields
    const response = await request.get('http://localhost:4000/api/missions');
    const missions = await response.json();
    const mission = missions.data.find(m => m.title === 'Test PR Integration');

    expect(mission.project_path).toBe(TEST_PROJECT_PATH);
    expect(mission.branch_name).toMatch(/^haflow\/m-[a-f0-9]+$/);
  });

  test('PR link displayed after workflow completion', async ({ page }) => {
    // This test requires a full workflow execution
    // Setup: Create mission, advance through all steps

    // Wait for mission completion (may take several minutes)
    await page.waitForSelector('[data-testid="pr-link"]', { timeout: 180000 });

    // Verify PR link is visible and correct format
    const prLink = await page.locator('[data-testid="pr-link"]');
    await expect(prLink).toBeVisible();

    const href = await prLink.getAttribute('href');
    expect(href).toMatch(/github\.com.*\/pull\/\d+/);
  });

  test('changed files tree displays modified files', async ({ page }) => {
    // Assumes PR already created from previous test

    await page.waitForSelector('[data-testid="changed-files-tree"]');
    const tree = await page.locator('[data-testid="changed-files-tree"]');

    await expect(tree).toBeVisible();
    // Verify at least one file is shown
    const fileItems = await tree.locator('[data-testid^="file-"]').count();
    expect(fileItems).toBeGreaterThan(0);
  });

  test('branch created in test repository', async ({ page, request }) => {
    // Create mission
    await page.goto('/');
    await page.click('[data-testid="new-mission-button"]');
    await page.fill('[data-testid="mission-title-input"]', 'Branch Test');
    await page.fill('[data-testid="mission-raw-input"]', 'Test branch creation');
    await page.click('[data-testid="create-mission-button"]');

    // Get mission ID
    const response = await request.get('http://localhost:4000/api/missions');
    const missions = await response.json();
    const mission = missions.data.find(m => m.title === 'Branch Test');

    // Check if branch exists in git repo
    const { stdout } = await execAsync(
      `cd "${TEST_PROJECT_PATH}" && git branch -a`
    );

    expect(stdout).toContain(mission.branch_name);
  });
});
```

#### 3. Required data-testid Attributes

Add to frontend components:

| Component | File | TestId |
|-----------|------|--------|
| PrLink | `PrLink.tsx` | `data-testid="pr-link"` |
| ChangedFilesTree | `ChangedFilesTree.tsx` | `data-testid="changed-files-tree"` |
| File items | `ChangedFilesTree.tsx` | `data-testid="file-{path}"` |
| Branch display | `MissionDetail.tsx` | `data-testid="branch-name"` |

#### 4. NPM Scripts

Add to `packages/frontend/package.json`:

```json
{
  "scripts": {
    "test:e2e:docker": "playwright test --grep @docker",
    "test:e2e:pr": "playwright test github-pr-integration"
  }
}
```

### Alternative: Backend Integration Tests

If full E2E is too complex, backend integration tests can cover most functionality:

**File**: `packages/backend/tests/integration/github-pr.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { missionStore } from '../../../src/services/mission-store';
import { getLinkedProject } from '../../../src/utils/cli-config';
import { createPullRequest, getChangedFiles } from '../../../src/services/github';

const skipInCi = Boolean(process.env.CI);

describe.skipIf(skipInCi)('GitHub PR Integration', () => {
  // Tests here...
});
```

### Test Execution Strategy

1. **Local Development**:
   ```bash
   # Setup: Link a real git project
   haflow link /path/to/test-repo

   # Run E2E tests
   cd packages/frontend
   pnpm test:e2e github-pr-integration
   ```

2. **Non-CI Automation**:
   ```bash
   # GitHub Actions with self-hosted runner
   # Or local CI with Docker socket mounted
   HAFLOW_HOME=/tmp/haflow-test pnpm test:e2e:docker
   ```

3. **Skip in CI**:
   - Tests automatically skip when `process.env.CI` is set
   - Can also use Playwright tags: `test('name', { tag: '@docker' }, ...)`

## Code References

- Playwright config: `packages/frontend/playwright.config.ts:1-47`
- E2E environment: `packages/frontend/tests/e2e-env.ts:1-24`
- Global teardown: `packages/frontend/tests/globalTeardown.ts:1-35`
- Backend Docker tests: `packages/backend/tests/integration/docker/postgres.test.ts:1-346`
- Test fixture example: `packages/backend/tests/resource/vue-frontend/`
- CLI config reader: `packages/backend/src/utils/cli-config.ts`
- GitHub service: `packages/backend/src/services/github.ts`
- Frontend components:
  - `packages/frontend/src/components/PrLink.tsx`
  - `packages/frontend/src/components/ChangedFilesTree.tsx`
  - `packages/frontend/src/components/MissionDetail.tsx:423-455`

## Architecture Insights

1. **Test Isolation**: Each test run gets a unique `HAFLOW_HOME` directory
2. **Docker Labels**: All containers get `haflow.mission_id` label for cleanup
3. **CI Safety**: `process.env.CI` check prevents Docker-dependent tests from running in GitHub Actions
4. **Test Fixture Pattern**: Use local git repos with known state for reproducible tests
5. **Timeout Strategy**: Docker-heavy tests need 60-180 second timeouts

## Historical Context (from thoughts/)

- Implementation plan: `thoughts/shared/plans/2026-01-24-external-project-github-pr-integration.md`
- Handoff document: `thoughts/shared/handoffs/general/2026-01-24_19-08-49_external-project-github-pr-integration.md`
- E2E test design: `thoughts/shared/docs/e2e-mission-lifecycle-tests-overview.md`

## Open Questions

1. **Test Git Repository**: Should the test fixture be a real GitHub repo or can it use a local bare repo?
2. **PR Cleanup**: Should tests delete created PRs after completion, or leave them for manual review?
3. **Agent Mocking**: For faster tests, should we mock the agent execution or run real agents?
4. **SSH Key Handling**: How to handle SSH keys in the test environment for git push operations?
5. **gh CLI Auth**: Should tests verify `gh auth status` in beforeAll or assume it's configured?
