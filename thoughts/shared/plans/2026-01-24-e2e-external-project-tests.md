# E2E Tests for External Project Integration Implementation Plan

## Overviewש

Create Playwright E2E tests to verify the external project GitHub integration works correctly. Tests will validate: project linking via CLI config, project mounting in containers, git branch creation, and frontend display of branch/changed files. PR creation is explicitly out of scope.

## Current State Analysis

### What Exists
- Playwright E2E tests at `packages/frontend/tests/e2e/` with 3 test files
- Vue test fixture at `packages/backend/tests/resource/vue-frontend/` (but it's part of main repo, not standalone)
- MissionDetail already has data-testid attributes:
  - `data-testid="pr-link"` - PR link element
  - `data-testid="branch-name"` - Branch name display
  - `data-testid="changed-files-tree"` - Changed files tree
  - `data-testid="changed-file-{path}"` - Individual file items
- Global setup/teardown handles Docker cleanup via `haflow.mission_id` label
- Test environment isolation via unique `HAFLOW_HOME` per run

### What's Missing
- Standalone git repository test fixture
- E2E tests for external project integration flow
- Test helper to write CLI config (`~/.haflow/config.json`)

### Key Discoveries
- Existing tests use `test.skip(!!process.env.CI, 'reason')` for CI skipping
- Tests can use `request` fixture for direct API calls
- Docker containers are cleaned up in globalTeardown by label
- Vue fixture path: `packages/backend/tests/resource/vue-frontend/`

## Desired End State

E2E tests that verify:
1. Mission created with linked project has `project_path` and `branch_name` in API response
2. Git branch `haflow/{mission-id}` is created in the test repository
3. Frontend displays branch name when mission has `branch_name`
4. Frontend displays changed files tree when files are modified

### Verification
- Run `pnpm --filter frontend test:e2e:project` locally (with Docker)
- Tests skip automatically in CI
- Tests clean up git branches and Docker containers after completion

## What We're NOT Doing

- PR creation testing (explicitly out of scope per user request)
- PR link display testing
- GitHub API integration testing
- Testing actual Claude agent execution (too slow for E2E)
- Multi-project linking scenarios

## Implementation Approach

We'll use the existing Vue fixture but initialize it as a standalone git repo with a test setup script. Tests will write to the CLI config file directly, create missions via API, and verify the integration works.

---

## Phase 1: Initialize Test Git Repository Fixture

### Overview
Convert the existing Vue fixture into a standalone git repository that can be used for testing external project integration.

### Changes Required

#### 1. Create Git Initialization Script
**File**: `packages/frontend/tests/scripts/setup-test-git-repo.sh` (new file)

```bash
#!/bin/bash
set -e

FIXTURE_PATH="$1"

if [ -z "$FIXTURE_PATH" ]; then
    echo "Usage: setup-test-git-repo.sh <path>"
    exit 1
fi

cd "$FIXTURE_PATH"

# Remove existing .git if present (for clean state)
rm -rf .git

# Initialize fresh git repo
git init
git config user.email "test@haflow.local"
git config user.name "Haflow Test"

# Create initial commit
git add -A
git commit -m "Initial commit for E2E testing"

# Create a bare repo to act as "origin" for push testing
BARE_REPO="${FIXTURE_PATH}/../test-git-project-bare.git"
rm -rf "$BARE_REPO"
git clone --bare "$FIXTURE_PATH" "$BARE_REPO"

# Add the bare repo as origin
git remote add origin "$BARE_REPO"
git fetch origin
git branch --set-upstream-to=origin/main main 2>/dev/null || git branch --set-upstream-to=origin/master master

echo "Test git repository initialized at $FIXTURE_PATH"
echo "Bare origin at $BARE_REPO"
```

#### 2. Add Script Execution Permission
Run during test setup or manually before tests.

### Success Criteria

#### Automated Verification
- [ ] Script is executable: `chmod +x packages/frontend/tests/scripts/setup-test-git-repo.sh`
- [ ] Script runs without error on Vue fixture

#### Manual Verification
- [ ] `packages/backend/tests/resource/vue-frontend/.git` exists after running script
- [ ] `git log` shows initial commit
- [ ] `git remote -v` shows origin pointing to bare repo

---

## Phase 2: Create E2E Test Infrastructure

### Overview
Add test helpers and configuration for external project E2E tests.

### Changes Required

#### 1. Update E2E Environment Configuration
**File**: `packages/frontend/tests/e2e-env.ts`

Add export for test fixture paths:

```typescript
import { mkdtempSync, existsSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Existing code...

// Test git project fixture path
export const TEST_GIT_PROJECT_PATH = join(
  __dirname,
  '../../packages/backend/tests/resource/vue-frontend'
);

// Bare repo path (created by setup script)
export const TEST_GIT_BARE_REPO_PATH = join(
  __dirname,
  '../../packages/backend/tests/resource/test-git-project-bare.git'
);
```

#### 2. Create Test Helper for CLI Config
**File**: `packages/frontend/tests/helpers/cli-config.ts` (new file)

```typescript
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

export interface CliConfig {
  linkedProject?: string;
}

export function writeCliConfig(haflowHome: string, config: CliConfig): void {
  const configPath = join(haflowHome, 'config.json');
  const configDir = dirname(configPath);

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

export function linkProject(haflowHome: string, projectPath: string): void {
  writeCliConfig(haflowHome, { linkedProject: projectPath });
}
```

#### 3. Create Git Helper for Test Cleanup
**File**: `packages/frontend/tests/helpers/git-cleanup.ts` (new file)

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function cleanupTestBranches(
  projectPath: string,
  branchPrefix: string = 'haflow/'
): Promise<void> {
  try {
    // Get all local branches matching prefix
    const { stdout } = await execAsync(
      `cd "${projectPath}" && git branch --list "${branchPrefix}*"`,
      { timeout: 10000 }
    );

    const branches = stdout
      .trim()
      .split('\n')
      .map(b => b.trim().replace('* ', ''))
      .filter(Boolean);

    // Delete each branch
    for (const branch of branches) {
      await execAsync(
        `cd "${projectPath}" && git branch -D "${branch}"`,
        { timeout: 5000 }
      ).catch(() => {}); // Ignore errors
    }

    // Also delete from bare repo origin
    for (const branch of branches) {
      await execAsync(
        `cd "${projectPath}" && git push origin --delete "${branch}"`,
        { timeout: 5000 }
      ).catch(() => {}); // Ignore errors
    }

    if (branches.length > 0) {
      console.log(`Cleaned up ${branches.length} test branches`);
    }
  } catch {
    // Git not available or no branches to clean
  }
}

export async function resetToMain(projectPath: string): Promise<void> {
  try {
    await execAsync(
      `cd "${projectPath}" && git checkout main 2>/dev/null || git checkout master`,
      { timeout: 5000 }
    );
    await execAsync(
      `cd "${projectPath}" && git reset --hard origin/main 2>/dev/null || git reset --hard origin/master`,
      { timeout: 5000 }
    );
  } catch {
    // Ignore errors
  }
}
```

### Success Criteria

#### Automated Verification
- [ ] TypeScript compiles: `pnpm --filter frontend build`
- [ ] No lint errors in new files

#### Manual Verification
- [ ] Helper functions work when called from test

---

## Phase 3: Write E2E Tests

### Overview
Create Playwright tests for the external project integration flow.

### Changes Required

#### 1. Create Test File
**File**: `packages/frontend/tests/e2e/external-project.test.ts` (new file)

```typescript
import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { existsSync } from 'fs';
import { linkProject } from '../helpers/cli-config';
import { cleanupTestBranches, resetToMain } from '../helpers/git-cleanup';
import { TEST_DIR } from '../e2e-env';

const execAsync = promisify(exec);

// Path to test git fixture (relative from frontend package)
const TEST_PROJECT_PATH = join(__dirname, '../../../backend/tests/resource/vue-frontend');

// Skip all tests in CI - requires Docker and local git setup
const skipInCi = !!process.env.CI;

test.describe('External Project Integration', () => {
  test.skip(skipInCi, 'Requires Docker and local git repository');

  // Track created missions for cleanup
  const createdMissionIds: string[] = [];

  test.beforeAll(async () => {
    // Verify test project exists and is a git repo
    const gitDir = join(TEST_PROJECT_PATH, '.git');
    if (!existsSync(gitDir)) {
      throw new Error(
        `Test git repository not initialized. Run: packages/frontend/tests/scripts/setup-test-git-repo.sh ${TEST_PROJECT_PATH}`
      );
    }

    // Reset to clean state
    await resetToMain(TEST_PROJECT_PATH);
  });

  test.beforeEach(async () => {
    // Link the test project via CLI config
    linkProject(TEST_DIR, TEST_PROJECT_PATH);
  });

  test.afterAll(async () => {
    // Cleanup test branches
    await cleanupTestBranches(TEST_PROJECT_PATH);
    await resetToMain(TEST_PROJECT_PATH);
  });

  test('mission created with linked project has project_path and branch_name', async ({ request }) => {
    // Create mission via API
    const response = await request.post('http://localhost:4000/api/missions', {
      data: {
        title: 'Test External Project',
        type: 'feature',
        rawInput: 'Test the external project integration',
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.data.project_path).toBe(TEST_PROJECT_PATH);
    expect(body.data.branch_name).toMatch(/^haflow\/m-[a-f0-9]+$/);

    createdMissionIds.push(body.data.mission_id);
  });

  test('API returns mission with project fields in list', async ({ request }) => {
    // Create mission first
    const createResponse = await request.post('http://localhost:4000/api/missions', {
      data: {
        title: 'Test Project Fields in List',
        type: 'feature',
        rawInput: 'Test listing',
      },
    });
    const createBody = await createResponse.json();
    const missionId = createBody.data.mission_id;
    createdMissionIds.push(missionId);

    // Get missions list
    const listResponse = await request.get('http://localhost:4000/api/missions');
    const listBody = await listResponse.json();

    const mission = listBody.data.find((m: any) => m.mission_id === missionId);
    expect(mission).toBeDefined();
    expect(mission.project_path).toBe(TEST_PROJECT_PATH);
    expect(mission.branch_name).toBeDefined();
  });

  test('frontend displays branch name for linked project mission', async ({ page, request }) => {
    // Create mission via API
    const response = await request.post('http://localhost:4000/api/missions', {
      data: {
        title: 'Test Branch Display',
        type: 'feature',
        rawInput: 'Test branch name display in UI',
      },
    });
    const body = await response.json();
    const missionId = body.data.mission_id;
    createdMissionIds.push(missionId);

    // Navigate to the mission
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click on the mission in sidebar
    const missionItem = page.getByTestId(`mission-item-${missionId}`);
    await missionItem.click();
    await page.waitForLoadState('networkidle');

    // Verify branch name is displayed
    const branchName = page.getByTestId('branch-name');
    await expect(branchName).toBeVisible({ timeout: 5000 });
    await expect(branchName).toContainText('haflow/');
  });

  test('git branch is created in test repository after mission continues', async ({ request }) => {
    // Create mission
    const createResponse = await request.post('http://localhost:4000/api/missions', {
      data: {
        title: 'Test Git Branch Creation',
        type: 'feature',
        rawInput: 'Test that git branch is created',
      },
    });
    const createBody = await createResponse.json();
    const missionId = createBody.data.mission_id;
    const branchName = createBody.data.branch_name;
    createdMissionIds.push(missionId);

    // Continue the mission to trigger agent step (which creates the branch)
    await request.post(`http://localhost:4000/api/missions/${missionId}/continue`);

    // Wait a bit for the container to start and run git setup
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check if branch exists in git repo
    const { stdout } = await execAsync(
      `cd "${TEST_PROJECT_PATH}" && git branch -a`
    );

    expect(stdout).toContain(branchName);
  });

  test('mission without linked project has no project fields', async ({ request }) => {
    // Remove the linked project config
    linkProject(TEST_DIR, ''); // Empty string = no project

    // Create mission
    const response = await request.post('http://localhost:4000/api/missions', {
      data: {
        title: 'Test No Project',
        type: 'feature',
        rawInput: 'Test without linked project',
      },
    });
    const body = await response.json();
    createdMissionIds.push(body.data.mission_id);

    expect(body.data.project_path).toBeUndefined();
    expect(body.data.branch_name).toBeUndefined();
  });
});
```

#### 2. Add NPM Script
**File**: `packages/frontend/package.json`

Add to scripts:

```json
{
  "scripts": {
    "test:e2e:project": "playwright test external-project"
  }
}
```

### Success Criteria

#### Automated Verification
- [ ] TypeScript compiles: `pnpm --filter frontend build`
- [ ] Playwright can parse tests: `pnpm --filter frontend test:e2e --list`

#### Manual Verification
- [ ] Run setup script: `./packages/frontend/tests/scripts/setup-test-git-repo.sh packages/backend/tests/resource/vue-frontend`
- [ ] Run tests locally: `pnpm --filter frontend test:e2e:project`
- [ ] All tests pass
- [ ] Tests skip in CI (set `CI=true` and verify skip message)

---

## Phase 4: Update Global Teardown for Git Cleanup

### Overview
Ensure git branches created during tests are cleaned up.

### Changes Required

#### 1. Update Global Teardown
**File**: `packages/frontend/tests/globalTeardown.ts`

Add git cleanup:

```typescript
import type { FullConfig } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import { rm } from 'fs/promises';
import { join } from 'path';
import { TEST_DIR } from './e2e-env';

const execAsync = promisify(exec);

// Test git project path
const TEST_PROJECT_PATH = join(__dirname, '../../backend/tests/resource/vue-frontend');

export default async function globalTeardown(_config: FullConfig) {
  // Cleanup test directory
  try {
    await rm(TEST_DIR, { recursive: true, force: true });
    console.log(`Cleaned up test directory: ${TEST_DIR}`);
  } catch {
    // Directory may already be cleaned up
  }

  // Cleanup any orphaned Docker containers from tests
  try {
    const { stdout } = await execAsync(
      'docker ps -aq --filter="label=haflow.mission_id"'
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

  // Cleanup test git branches
  try {
    const { stdout } = await execAsync(
      `cd "${TEST_PROJECT_PATH}" && git branch --list "haflow/*"`,
      { timeout: 5000 }
    );
    const branches = stdout.trim().split('\n').filter(Boolean);
    for (const branch of branches) {
      const branchName = branch.trim().replace('* ', '');
      await execAsync(
        `cd "${TEST_PROJECT_PATH}" && git branch -D "${branchName}"`,
        { timeout: 5000 }
      ).catch(() => {});
    }
    if (branches.length > 0) {
      console.log(`Cleaned up ${branches.length} test git branches`);
    }

    // Reset to main
    await execAsync(
      `cd "${TEST_PROJECT_PATH}" && git checkout main 2>/dev/null || git checkout master`,
      { timeout: 5000 }
    ).catch(() => {});
  } catch {
    // Git not available or cleanup failed
  }

  console.log('E2E test teardown complete');
}
```

### Success Criteria

#### Automated Verification
- [ ] TypeScript compiles: `pnpm --filter frontend build`

#### Manual Verification
- [ ] Run tests, verify branches are cleaned up after
- [ ] `git branch -a` in test project shows no `haflow/*` branches after test run

---

## Testing Strategy

### Unit Tests
N/A - This is E2E test implementation

### Integration Tests
The E2E tests themselves are integration tests covering:
- API → Backend → CLI Config reading
- API → Backend → Docker → Git branch creation
- Frontend → API → Display of project fields

### Manual Testing Steps
1. Run setup script: `./packages/frontend/tests/scripts/setup-test-git-repo.sh packages/backend/tests/resource/vue-frontend`
2. Start backend and frontend: `pnpm dev`
3. Run tests: `pnpm --filter frontend test:e2e:project`
4. Verify all tests pass
5. Check git repo is clean after tests

## Performance Considerations

- Tests that trigger agent execution have 5+ second waits for container startup
- Git operations are fast (<1s)
- Total test suite should complete in <60 seconds

## Migration Notes

- Existing Vue fixture will be converted to a git repo (non-breaking)
- New test file won't affect existing tests
- CI will skip these tests automatically

## References

- Implementation plan: `thoughts/shared/plans/2026-01-24-external-project-github-pr-integration.md`
- Research document: `thoughts/shared/research/2026-01-24-e2e-external-project-github-pr-integration.md`
- Existing E2E tests: `packages/frontend/tests/e2e/`
- Test fixture: `packages/backend/tests/resource/vue-frontend/`
- MissionDetail component: `packages/frontend/src/components/MissionDetail.tsx:423-454`
