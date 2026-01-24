# E2E Mission Lifecycle Tests Implementation Plan

## Overview

Implement comprehensive E2E tests for the Haflow mission lifecycle, covering creation, selection, workflow progression, artifact editing, and error handling. Tests require Docker (mock agent mode) and are skipped in CI environments.

## Current State Analysis

### Existing Coverage
- `home.test.ts`: 5 tests for page load, welcome message, navigation, modal open/close
- `voice-transcription.test.ts`: ~15 tests for voice chat and transcription features

### Gaps
- No tests for mission creation flow
- No tests for mission selection and detail view
- No tests for workflow progression (human gates → agent execution)
- No tests for artifact editing and persistence
- No tests for error states

### Test Infrastructure
- Playwright configured with global setup/teardown
- Backend mock agent completes in 1-3 seconds (uses `node:20-slim` container)
- Isolated `HAFLOW_HOME` at `/tmp/haflow-e2e/`
- Docker containers cleaned up via label filtering

### Current data-testid Attributes  (Need more)
- `new-mission-button` (Sidebar.tsx:87)

## Desired End State

After implementation:
1. **20+ new E2E tests** covering mission lifecycle
2. **~25 new data-testid attributes** enabling reliable element selection
3. **All tests skip in CI** (require Docker)
4. **Chromium-only** for speed
5. **Self-contained tests** that create their own missions

### Verification
- Run `pnpm --filter frontend test:e2e` locally with Docker running
- All tests pass on Chromium
- Tests skip cleanly when `CI=true`

## What We're NOT Doing

- Multi-browser testing (Chromium only)
- CI execution (tests require Docker)
- Test fixtures/pre-seeded data (each test creates from scratch)
- Page object pattern (following existing test style)
- Real Claude agent execution (uses mock agent)

## Implementation Approach

1. Add data-testid attributes to all testable elements
2. Create test file structure mirroring the test plan phases
3. Implement tests from simplest (creation) to most complex (workflow progression)
4. Each test is independent and creates its own mission

---

## Phase 1: Add data-testid Attributes to Frontend Components

### Overview
Add test identifiers to all interactive elements needed for E2E testing. This is a prerequisite for reliable test selection.

### Changes Required:

#### 1. Sidebar.tsx
**File**: `packages/frontend/src/components/Sidebar.tsx`

**Line 61** - Add to sidebar container:
```tsx
<div
  data-testid="sidebar"
  className={cn(
```

**Line 101** - Add to mission list container:
```tsx
<div data-testid="mission-list" className="space-y-1 px-2 pb-4">
```

**Line 103** - Add dynamic testid to mission items:
```tsx
<button
  key={mission.mission_id}
  data-testid={`mission-item-${mission.mission_id}`}
  onClick={() => onSelectMission(mission.mission_id)}
```

**Line 117** - Add testid to StatusBadge (modify StatusBadge component):
```tsx
function StatusBadge({ status, testId }: { status: MissionStatus; testId?: string }) {
  const config = statusConfig[status]
  return (
    <Badge data-testid={testId} variant={config.variant} className="text-[10px] px-1.5 py-0">
      {config.label}
    </Badge>
  )
}
```

Then update usage at line 117:
```tsx
<StatusBadge status={mission.status} testId={`mission-status-${mission.mission_id}`} />
```

#### 2. NewMissionModal.tsx
**File**: `packages/frontend/src/components/NewMissionModal.tsx`

**Line 56** - Add to DialogContent:
```tsx
<DialogContent data-testid="new-mission-modal" className="sm:max-w-lg">
```

**Line 66** - Add to title input:
```tsx
<Input
  id="title"
  data-testid="mission-title-input"
  value={title}
```

**Line 78** - Add to select trigger:
```tsx
<SelectTrigger data-testid="mission-type-select">
```

**Line 98** - Add to rawInput textarea:
```tsx
<Textarea
  id="rawInput"
  data-testid="mission-raw-input"
  value={rawInput}
```

**Line 110** - Add to cancel button:
```tsx
<Button type="button" variant="outline" onClick={onClose} data-testid="cancel-button">
```

**Line 113** - Add to submit button:
```tsx
<Button
  type="submit"
  data-testid="create-mission-button"
  disabled={!title.trim() || !rawInput.trim() || isSubmitting}
```

#### 3. MissionDetail.tsx
**File**: `packages/frontend/src/components/MissionDetail.tsx`

**Line 32** - Add to workflow timeline container:
```tsx
<div data-testid="workflow-timeline" className="flex items-center gap-1 py-4 px-4 md:px-6 overflow-x-auto">
```

**Line 38** - Add to workflow step:
```tsx
<div key={step.step_id} data-testid={`workflow-step-${i}`} className="flex items-center">
```

**Line 83** - Add to activity history toggle:
```tsx
<button
  data-testid="activity-history-toggle"
  onClick={() => setIsOpen(!isOpen)}
```

**Line 219** - Add to mission header:
```tsx
<div data-testid="mission-detail-header" className="bg-background border-b px-4 md:px-6 py-4">
```

**Line 221** - Add to mission title:
```tsx
<h2 data-testid="mission-title" className="text-lg md:text-xl font-semibold truncate">
```

**Line 224** - Add to status badge:
```tsx
<Badge data-testid="mission-status-badge" variant={statusInfo.variant} className="w-fit">
```

**Line 245** - Add to log viewer:
```tsx
<pre data-testid="agent-log-viewer" className="font-mono text-sm bg-zinc-900 text-zinc-100 p-4 rounded-lg overflow-auto">
```

**Line 263** - Add to editor view mode button:
```tsx
<Button
  data-testid="view-mode-editor"
  variant={viewMode === 'editor' ? 'secondary' : 'ghost'}
```

**Line 271** - Add to diff view mode button:
```tsx
<Button
  data-testid="view-mode-diff"
  variant={viewMode === 'diff' ? 'secondary' : 'ghost'}
```

**Line 279** - Add to preview view mode button:
```tsx
<Button
  data-testid="view-mode-preview"
  variant={viewMode === 'preview' ? 'secondary' : 'ghost'}
```

**Line 289** - Add to save draft button:
```tsx
<Button
  data-testid="save-draft-button"
  variant="outline"
  size="sm"
  onClick={handleSave}
  disabled={!hasChanges}
```

**Line 298** - Add to continue button:
```tsx
<Button data-testid="continue-button" size="sm" onClick={onContinue} className="flex-1 md:flex-none">
```

**Line 308** - Add to artifact editor textarea:
```tsx
<Textarea
  data-testid="artifact-editor"
  value={editorContent}
```

**Line 337** - Add to error message:
```tsx
<pre data-testid="error-message" className="font-mono text-sm bg-zinc-900 text-zinc-100 p-4 rounded-lg overflow-auto">
```

**Line 345** - Add to mark completed button:
```tsx
<Button data-testid="mark-completed-button" variant="outline" onClick={onMarkCompleted}>
```

**Line 357** - Add to start agent button:
```tsx
<Button data-testid="start-agent-button" onClick={onContinue}>
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter frontend build`
- [x] Linting passes: `pnpm --filter frontend lint` (pre-existing errors unrelated to testids)
- [ ] App loads without errors: Start dev server and verify UI works

#### Manual Verification:
- [ ] Inspect elements in browser DevTools to confirm data-testid attributes are present

---

## Phase 2: Create Test File Structure and CI Skip Logic

### Overview
Create the test file structure and add CI skip configuration.

### Changes Required:

#### 1. Update Playwright Config for Chromium-Only
**File**: `packages/frontend/playwright.config.ts`

Replace projects array (lines 20-33) with Chromium only:
```typescript
projects: [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
],
```

#### 2. Create Mission Lifecycle Test File
**File**: `packages/frontend/tests/e2e/mission-lifecycle.test.ts`

```typescript
import { test, expect } from '@playwright/test';

// Skip all tests in CI - they require Docker for mock agent execution
test.beforeEach(async ({ page }) => {
  test.skip(!!process.env.CI, 'Skipped in CI - requires Docker');
});

test.describe('Mission Creation', () => {
  test('should create a mission with all required fields', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open new mission modal
    await page.getByTestId('new-mission-button').click();
    await expect(page.getByTestId('new-mission-modal')).toBeVisible();

    // Fill in mission details
    await page.getByTestId('mission-title-input').fill('test-feature-auth');
    await page.getByTestId('mission-raw-input').fill('Implement user authentication with JWT tokens');

    // Submit
    await page.getByTestId('create-mission-button').click();

    // Modal should close
    await expect(page.getByTestId('new-mission-modal')).not.toBeVisible();

    // Mission should appear in sidebar
    await expect(page.getByTestId('mission-list')).toContainText('test-feature-auth');
  });

  test('should show validation by disabling submit when fields empty', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.getByTestId('new-mission-button').click();

    // Submit button should be disabled when fields are empty
    await expect(page.getByTestId('create-mission-button')).toBeDisabled();

    // Fill only title
    await page.getByTestId('mission-title-input').fill('test-mission');
    await expect(page.getByTestId('create-mission-button')).toBeDisabled();

    // Fill raw input
    await page.getByTestId('mission-raw-input').fill('Some description');
    await expect(page.getByTestId('create-mission-button')).toBeEnabled();
  });

  test('should auto-select newly created mission', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Create mission
    await page.getByTestId('new-mission-button').click();
    await page.getByTestId('mission-title-input').fill('auto-select-test');
    await page.getByTestId('mission-raw-input').fill('Test auto selection');
    await page.getByTestId('create-mission-button').click();

    // Mission detail should show
    await expect(page.getByTestId('mission-title')).toContainText('auto-select-test');
    await expect(page.getByTestId('mission-status-badge')).toContainText('Ready');
  });
});

test.describe('Mission Selection', () => {
  test('should display mission detail when clicked in sidebar', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Create a mission first
    await page.getByTestId('new-mission-button').click();
    await page.getByTestId('mission-title-input').fill('selection-test');
    await page.getByTestId('mission-raw-input').fill('Test mission selection');
    await page.getByTestId('create-mission-button').click();
    await page.waitForLoadState('networkidle');

    // Click on the mission in sidebar (find by title text within mission list)
    const missionList = page.getByTestId('mission-list');
    await missionList.getByText('selection-test').click();

    // Verify detail view
    await expect(page.getByTestId('mission-detail-header')).toBeVisible();
    await expect(page.getByTestId('mission-title')).toContainText('selection-test');
  });

  test('should display workflow timeline with current step highlighted', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Create and select mission
    await page.getByTestId('new-mission-button').click();
    await page.getByTestId('mission-title-input').fill('timeline-test');
    await page.getByTestId('mission-raw-input').fill('Test workflow timeline');
    await page.getByTestId('create-mission-button').click();

    // Verify timeline exists with steps
    await expect(page.getByTestId('workflow-timeline')).toBeVisible();
    await expect(page.getByTestId('workflow-step-0')).toBeVisible();
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] Test file compiles: `pnpm --filter frontend exec playwright test --list`
- [x] Tests skip in CI: `CI=true pnpm --filter frontend test:e2e` shows skipped tests

#### Manual Verification:
- [ ] Tests run locally with Docker: `pnpm --filter frontend test:e2e`

---

## Phase 3: Workflow Progression Tests

### Overview
Test the mission workflow progression through human gates and agent execution.

### Changes Required:

#### 1. Add Workflow Progression Tests
**File**: `packages/frontend/tests/e2e/mission-lifecycle.test.ts`

Append to the file:

```typescript
test.describe('Workflow Progression', () => {
  test('should start agent and show running status', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Create mission
    await page.getByTestId('new-mission-button').click();
    await page.getByTestId('mission-title-input').fill('agent-start-test');
    await page.getByTestId('mission-raw-input').fill('Test agent execution');
    await page.getByTestId('create-mission-button').click();
    await page.waitForLoadState('networkidle');

    // Mission should be in 'ready' state with Start Agent button
    await expect(page.getByTestId('start-agent-button')).toBeVisible();

    // Start agent
    await page.getByTestId('start-agent-button').click();

    // Status should change to running
    await expect(page.getByTestId('mission-status-badge')).toContainText('Running', { timeout: 5000 });

    // Log viewer should appear
    await expect(page.getByTestId('agent-log-viewer')).toBeVisible({ timeout: 5000 });
  });

  test('should complete agent and transition to human gate', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Create mission
    await page.getByTestId('new-mission-button').click();
    await page.getByTestId('mission-title-input').fill('agent-complete-test');
    await page.getByTestId('mission-raw-input').fill('Test agent completion');
    await page.getByTestId('create-mission-button').click();
    await page.waitForLoadState('networkidle');

    // Start agent
    await page.getByTestId('start-agent-button').click();

    // Wait for agent to complete (mock agent takes 1-3 seconds)
    // Status should transition to waiting_human
    await expect(page.getByTestId('mission-status-badge')).toContainText('Waiting', { timeout: 15000 });

    // Editor should now be visible for human review
    await expect(page.getByTestId('artifact-editor')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('continue-button')).toBeVisible();
  });

  test('should show human gate with artifact editor', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Create mission and wait for first agent to complete
    await page.getByTestId('new-mission-button').click();
    await page.getByTestId('mission-title-input').fill('human-gate-test');
    await page.getByTestId('mission-raw-input').fill('Test human gate');
    await page.getByTestId('create-mission-button').click();
    await page.waitForLoadState('networkidle');

    await page.getByTestId('start-agent-button').click();
    await expect(page.getByTestId('mission-status-badge')).toContainText('Waiting', { timeout: 15000 });

    // Verify editor controls
    await expect(page.getByTestId('view-mode-editor')).toBeVisible();
    await expect(page.getByTestId('view-mode-diff')).toBeVisible();
    await expect(page.getByTestId('view-mode-preview')).toBeVisible();
    await expect(page.getByTestId('save-draft-button')).toBeVisible();
    await expect(page.getByTestId('continue-button')).toBeVisible();
  });

  test('should advance through human gate to next agent step', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Create mission and complete first agent
    await page.getByTestId('new-mission-button').click();
    await page.getByTestId('mission-title-input').fill('advance-gate-test');
    await page.getByTestId('mission-raw-input').fill('Test advancing through gate');
    await page.getByTestId('create-mission-button').click();
    await page.waitForLoadState('networkidle');

    await page.getByTestId('start-agent-button').click();
    await expect(page.getByTestId('mission-status-badge')).toContainText('Waiting', { timeout: 15000 });

    // Click continue to advance through human gate
    await page.getByTestId('continue-button').click();

    // Should transition to running next agent
    await expect(page.getByTestId('mission-status-badge')).toContainText('Running', { timeout: 5000 });
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] Tests pass locally: `pnpm --filter frontend test:e2e tests/e2e/mission-lifecycle.test.ts`

#### Manual Verification:
- [ ] Observe workflow progression in browser during test execution

---

## Phase 4: Artifact Editing Tests

### Overview
Test artifact editing, saving drafts, and view mode switching.

### Changes Required:

#### 1. Add Artifact Editing Tests
**File**: `packages/frontend/tests/e2e/mission-lifecycle.test.ts`

Append to the file:

```typescript
test.describe('Artifact Editing', () => {
  // Helper to get mission to human gate state
  async function createMissionAndReachHumanGate(page: import('@playwright/test').Page, title: string) {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.getByTestId('new-mission-button').click();
    await page.getByTestId('mission-title-input').fill(title);
    await page.getByTestId('mission-raw-input').fill('Test mission for artifact editing');
    await page.getByTestId('create-mission-button').click();
    await page.waitForLoadState('networkidle');

    await page.getByTestId('start-agent-button').click();
    await expect(page.getByTestId('mission-status-badge')).toContainText('Waiting', { timeout: 15000 });
  }

  test('should enable save draft when content is modified', async ({ page }) => {
    await createMissionAndReachHumanGate(page, 'save-draft-test');

    // Save button should be disabled initially
    await expect(page.getByTestId('save-draft-button')).toBeDisabled();

    // Modify content
    const editor = page.getByTestId('artifact-editor');
    await editor.fill('Modified content for testing');

    // Save button should now be enabled
    await expect(page.getByTestId('save-draft-button')).toBeEnabled();
  });

  test('should persist changes after save draft', async ({ page }) => {
    await createMissionAndReachHumanGate(page, 'persist-draft-test');

    // Modify and save
    const editor = page.getByTestId('artifact-editor');
    const testContent = 'Unique test content ' + Date.now();
    await editor.fill(testContent);
    await page.getByTestId('save-draft-button').click();

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Content should persist
    await expect(page.getByTestId('artifact-editor')).toHaveValue(testContent);
  });

  test('should switch between editor, diff, and preview modes', async ({ page }) => {
    await createMissionAndReachHumanGate(page, 'view-modes-test');

    // Default is editor mode
    await expect(page.getByTestId('artifact-editor')).toBeVisible();

    // Switch to diff mode
    await page.getByTestId('view-mode-diff').click();
    // Editor should be hidden, diff view should show
    await expect(page.getByTestId('artifact-editor')).not.toBeVisible();

    // Switch to preview mode
    await page.getByTestId('view-mode-preview').click();
    // Should show markdown preview
    await expect(page.getByTestId('artifact-editor')).not.toBeVisible();

    // Switch back to editor
    await page.getByTestId('view-mode-editor').click();
    await expect(page.getByTestId('artifact-editor')).toBeVisible();
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] Tests pass locally: `pnpm --filter frontend test:e2e tests/e2e/mission-lifecycle.test.ts`

#### Manual Verification:
- [ ] Artifact content actually persists across page reloads

---

## Phase 5: Error Handling and Multi-Mission Tests

### Overview
Test error states and multiple mission handling.

### Changes Required:

#### 1. Add Error and Multi-Mission Tests
**File**: `packages/frontend/tests/e2e/mission-lifecycle.test.ts`

Append to the file:

```typescript
test.describe('Multi-Mission', () => {
  test('should display multiple missions in sidebar', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Create first mission
    await page.getByTestId('new-mission-button').click();
    await page.getByTestId('mission-title-input').fill('multi-mission-1');
    await page.getByTestId('mission-raw-input').fill('First mission');
    await page.getByTestId('create-mission-button').click();
    await page.waitForLoadState('networkidle');

    // Create second mission
    await page.getByTestId('new-mission-button').click();
    await page.getByTestId('mission-title-input').fill('multi-mission-2');
    await page.getByTestId('mission-raw-input').fill('Second mission');
    await page.getByTestId('create-mission-button').click();
    await page.waitForLoadState('networkidle');

    // Both should be in sidebar
    const missionList = page.getByTestId('mission-list');
    await expect(missionList.getByText('multi-mission-1')).toBeVisible();
    await expect(missionList.getByText('multi-mission-2')).toBeVisible();
  });

  test('should switch between missions correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Create two missions
    await page.getByTestId('new-mission-button').click();
    await page.getByTestId('mission-title-input').fill('switch-test-1');
    await page.getByTestId('mission-raw-input').fill('First mission');
    await page.getByTestId('create-mission-button').click();
    await page.waitForLoadState('networkidle');

    await page.getByTestId('new-mission-button').click();
    await page.getByTestId('mission-title-input').fill('switch-test-2');
    await page.getByTestId('mission-raw-input').fill('Second mission');
    await page.getByTestId('create-mission-button').click();
    await page.waitForLoadState('networkidle');

    // Currently showing second mission
    await expect(page.getByTestId('mission-title')).toContainText('switch-test-2');

    // Click first mission
    await page.getByTestId('mission-list').getByText('switch-test-1').click();
    await expect(page.getByTestId('mission-title')).toContainText('switch-test-1');

    // Click second mission again
    await page.getByTestId('mission-list').getByText('switch-test-2').click();
    await expect(page.getByTestId('mission-title')).toContainText('switch-test-2');
  });
});

test.describe('Activity History', () => {
  test('should toggle activity history panel', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Create mission and run agent
    await page.getByTestId('new-mission-button').click();
    await page.getByTestId('mission-title-input').fill('activity-test');
    await page.getByTestId('mission-raw-input').fill('Test activity history');
    await page.getByTestId('create-mission-button').click();
    await page.waitForLoadState('networkidle');

    await page.getByTestId('start-agent-button').click();
    await expect(page.getByTestId('mission-status-badge')).toContainText('Waiting', { timeout: 15000 });

    // Toggle activity history
    await page.getByTestId('activity-history-toggle').click();

    // Should show activity entries
    await expect(page.getByText('Step 0:')).toBeVisible();
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] All tests pass: `pnpm --filter frontend test:e2e tests/e2e/mission-lifecycle.test.ts`

#### Manual Verification:
- [ ] Multi-mission scenarios work correctly in browser

---

## Testing Strategy

### Unit Tests
Not applicable - this plan covers E2E tests only.

### E2E Tests
- All tests in `tests/e2e/mission-lifecycle.test.ts`
- Requires Docker running locally
- Skips in CI environment
- Uses mock agent (completes in 1-3 seconds)

### Manual Testing Steps
1. Start Docker if not running
2. Run `pnpm --filter frontend test:e2e`
3. Verify all tests pass
4. Run with `CI=true` to verify skip behavior

## Performance Considerations

- Mock agent completes in 1-3 seconds (vs minutes for real Claude)
- Tests run sequentially (workers: 1) to avoid race conditions
- Each test creates fresh missions (no shared state)
- Global teardown cleans up Docker containers

## References

- Research document: `thoughts/shared/research/2026-01-24-e2e-test-planning.md`
- Existing tests: `packages/frontend/tests/e2e/home.test.ts`
- Playwright config: `packages/frontend/playwright.config.ts`
- MissionDetail component: `packages/frontend/src/components/MissionDetail.tsx`
- Mission engine (mock agent): `packages/backend/src/services/mission-engine.ts:221-256`
