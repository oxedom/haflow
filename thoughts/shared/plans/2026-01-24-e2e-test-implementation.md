# E2E Test Implementation Plan

## Overview

Implement comprehensive E2E tests for Haflow using the "simple" workflow (3-step: human-gate → agent → human-gate). This provides full mission lifecycle coverage with fast execution using the mock agent.

## Current State Analysis

**Existing E2E Tests** (`packages/frontend/tests/e2e/`):
- `home.test.ts` - Basic page loading, navigation, modal open/close
- `voice-transcription.test.ts` - Voice feature tests

**Existing Test IDs** (only 3):
- `voice-chat-button-desktop` (`App.tsx:184`)
- `voice-chat-button-mobile` (`App.tsx:161`)
- `new-mission-button` (`Sidebar.tsx:87`)

**Test Infrastructure**:
- Playwright with Chromium/Firefox/WebKit
- Global setup creates isolated `HAFLOW_HOME` at `/tmp/haflow-e2e/`
- Docker container cleanup in teardown
- Backend (port 4000) and frontend (port 5173) auto-started

**Simple Workflow** (`workflow.ts:19-27`):
```
Step 0: raw-input (human-gate) - review raw-input.md
Step 1: process (agent) - raw-input.md → output.md
Step 2: review (human-gate) - review output.md
```

**Mock Agent** (`mission-engine.ts:221-256`):
- Uses `node:20-slim` container
- Copies input to output with header
- Completes in ~2-3 seconds

## Desired End State

After implementation:
1. **18+ new E2E test cases** covering mission lifecycle
2. **12+ new test IDs** added to frontend components
3. **Full simple workflow lifecycle tested**: create → human review → agent execution → human review → complete
4. Tests run reliably in CI without real Docker/Claude dependencies

### Verification:
```bash
cd packages/frontend && pnpm exec playwright test --project=chromium
```
All tests pass including new mission lifecycle tests.

### Key Discoveries:
- Simple workflow is ideal: 3 steps, fast mock agent (`workflow.ts:19-27`)
- Mock agent uses `node:20-slim` with simple copy operation (`mission-engine.ts:237-248`)
- Frontend polls at 500ms during `running_code_agent` status (`App.tsx:40-46`)
- No existing test IDs on mission items, workflow steps, or action buttons

## What We're NOT Doing

- Real Docker/Claude integration tests (mock only)
- Cross-browser visual regression tests
- Performance/load testing
- Voice transcription E2E tests with real audio
- Testing the 8-step "raw-research-plan-implement" workflow
- Mobile-specific responsive tests

## Implementation Approach

1. **Add test IDs first** - Enable reliable element selection
2. **Build tests incrementally** - Start with creation, then selection, then full lifecycle
3. **Use simple workflow** - Fast execution, complete lifecycle coverage
4. **Leverage polling** - Wait for status changes rather than arbitrary timeouts

---

## Phase 1: Add Test IDs to Frontend Components

### Overview
Add `data-testid` attributes to all interactive elements needed for E2E testing.

### Changes Required:

#### 1. Sidebar Component
**File**: `packages/frontend/src/components/Sidebar.tsx`
**Changes**: Add test IDs to mission list items and status badges

```tsx
// Line 103-127: Add data-testid to mission button
<button
  key={mission.mission_id}
  onClick={() => onSelectMission(mission.mission_id)}
  data-testid={`mission-item-${mission.mission_id}`}
  className={cn(
    'w-full text-left p-3 rounded-md transition-colors',
    selectedMissionId === mission.mission_id
      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
      : 'hover:bg-sidebar-accent/50'
  )}
>
```

```tsx
// Line 39-46: Add data-testid to StatusBadge
function StatusBadge({ status }: { status: MissionStatus }) {
  const config = statusConfig[status]
  return (
    <Badge
      variant={config.variant}
      className="text-[10px] px-1.5 py-0"
      data-testid={`status-badge-${status}`}
    >
      {config.label}
    </Badge>
  )
}
```

#### 2. MissionDetail Component
**File**: `packages/frontend/src/components/MissionDetail.tsx`
**Changes**: Add test IDs to workflow timeline, editor, and action buttons

```tsx
// Line 38-61: Add data-testid to workflow step circles
<div
  data-testid={`workflow-step-${i}`}
  className={cn(
    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2',
    // ... existing classes
  )}
>
```

```tsx
// Line 245-248: Add data-testid to log viewer
<pre
  className="font-mono text-sm bg-zinc-900 text-zinc-100 p-4 rounded-lg overflow-auto"
  data-testid="log-viewer"
>
  {mission.current_log_tail || 'Waiting for output...'}
</pre>
```

```tsx
// Line 308-315: Add data-testid to artifact editor textarea
<Textarea
  value={editorContent}
  onChange={(e) => {
    setEditorContent(e.target.value)
    setHasChanges(true)
  }}
  className="w-full h-full min-h-75 font-mono text-sm resize-none"
  data-testid="artifact-editor"
/>
```

```tsx
// Line 289-297: Add data-testid to Save Draft button
<Button
  variant="outline"
  size="sm"
  onClick={handleSave}
  disabled={!hasChanges}
  className="flex-1 md:flex-none"
  data-testid="save-draft-btn"
>
  Save Draft
</Button>
```

```tsx
// Line 298-302: Add data-testid to Continue button
<Button size="sm" onClick={onContinue} className="flex-1 md:flex-none" data-testid="continue-btn">
  Continue
  <ArrowRight className="ml-2 h-4 w-4" />
</Button>
```

```tsx
// Line 357-360: Add data-testid to Start Agent button
<Button onClick={onContinue} data-testid="start-agent-btn">
  <Play className="mr-2 h-4 w-4" />
  Start Agent
</Button>
```

```tsx
// Line 345-347: Add data-testid to Mark Completed button
<Button variant="outline" onClick={onMarkCompleted} data-testid="mark-completed-btn">
  Mark as Completed
</Button>
```

#### 3. NewMissionModal Component
**File**: `packages/frontend/src/components/NewMissionModal.tsx`
**Changes**: Add test IDs to form elements and submit button

```tsx
// Line 146-151: Add data-testid to Create Mission button
<Button
  type="submit"
  disabled={!title.trim() || !rawInput.trim() || isSubmitting}
  data-testid="create-mission-btn"
>
  {isSubmitting ? 'Creating...' : 'Create Mission'}
</Button>
```

```tsx
// Line 108-109: Add data-testid to workflow select
<Select value={workflowId} onValueChange={setWorkflowId} data-testid="workflow-select">
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter frontend build`
- [ ] Lint passes: `pnpm --filter frontend lint`
- [ ] Existing E2E tests still pass: `cd packages/frontend && pnpm exec playwright test home.test.ts --project=chromium`

#### Manual Verification:
- [ ] No visual changes to the UI
- [ ] Test IDs visible in browser DevTools when inspecting elements

**Implementation Note**: After completing this phase, pause for verification before proceeding.

---

## Phase 2: Core Mission Tests

### Overview
Test mission creation, sidebar display, and mission selection with the simple workflow.

### Changes Required:

#### 1. New Test File
**File**: `packages/frontend/tests/e2e/mission-lifecycle.test.ts`
**Changes**: Create comprehensive mission lifecycle tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('Mission Creation', () => {
  test('should create mission with simple workflow', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open new mission modal
    await page.getByTestId('new-mission-button').click();
    await expect(page.getByRole('heading', { name: 'New Mission' })).toBeVisible();

    // Fill form
    await page.locator('input#title').fill('Test Mission E2E');
    await page.locator('textarea#rawInput').fill('This is test input for E2E testing.');

    // Select simple workflow
    await page.locator('[data-testid="workflow-select"]').click();
    await page.getByRole('option', { name: /Simple/ }).click();

    // Submit
    await page.getByTestId('create-mission-btn').click();

    // Verify mission appears in sidebar
    await expect(page.getByText('Test Mission E2E')).toBeVisible({ timeout: 5000 });
  });

  test('should show validation for empty fields', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.getByTestId('new-mission-button').click();

    // Submit button should be disabled with empty fields
    await expect(page.getByTestId('create-mission-btn')).toBeDisabled();

    // Fill only title
    await page.locator('input#title').fill('Only Title');
    await expect(page.getByTestId('create-mission-btn')).toBeDisabled();
  });

  test('should appear in sidebar after creation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Create mission
    await page.getByTestId('new-mission-button').click();
    await page.locator('input#title').fill('Sidebar Test Mission');
    await page.locator('textarea#rawInput').fill('Test input content.');
    await page.locator('[data-testid="workflow-select"]').click();
    await page.getByRole('option', { name: /Simple/ }).click();
    await page.getByTestId('create-mission-btn').click();

    // Verify in sidebar with correct status
    const missionItem = page.locator('[data-testid^="mission-item-"]').first();
    await expect(missionItem).toBeVisible({ timeout: 5000 });
    await expect(missionItem).toContainText('Sidebar Test Mission');
  });
});

test.describe('Mission Selection', () => {
  test.beforeEach(async ({ page }) => {
    // Create a mission first
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByTestId('new-mission-button').click();
    await page.locator('input#title').fill('Selection Test');
    await page.locator('textarea#rawInput').fill('Test content.');
    await page.locator('[data-testid="workflow-select"]').click();
    await page.getByRole('option', { name: /Simple/ }).click();
    await page.getByTestId('create-mission-btn').click();
    await expect(page.getByText('Selection Test')).toBeVisible({ timeout: 5000 });
  });

  test('should load mission detail when clicked', async ({ page }) => {
    // Click mission in sidebar
    await page.locator('[data-testid^="mission-item-"]').first().click();

    // Verify detail view loads
    await expect(page.getByText('Mission: Selection Test')).toBeVisible();
  });

  test('should display workflow timeline', async ({ page }) => {
    await page.locator('[data-testid^="mission-item-"]').first().click();

    // Verify workflow steps are visible
    await expect(page.getByTestId('workflow-step-0')).toBeVisible();
    await expect(page.getByTestId('workflow-step-1')).toBeVisible();
    await expect(page.getByTestId('workflow-step-2')).toBeVisible();
  });

  test('should show waiting_human status at step 0', async ({ page }) => {
    await page.locator('[data-testid^="mission-item-"]').first().click();

    // Simple workflow starts at human-gate (step 0)
    await expect(page.getByTestId('status-badge-waiting_human')).toBeVisible();
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] New tests pass: `cd packages/frontend && pnpm exec playwright test mission-lifecycle.test.ts --project=chromium`
- [ ] No regressions in existing tests

#### Manual Verification:
- [ ] Tests create real missions visible in UI
- [ ] Cleanup works (missions don't persist between test runs)

**Implementation Note**: After completing this phase, pause for verification before proceeding.

---

## Phase 3: Simple Workflow Full Lifecycle Tests

### Overview
Test the complete mission lifecycle through all 3 steps of the simple workflow.

### Changes Required:

#### 1. Add Lifecycle Tests to Test File
**File**: `packages/frontend/tests/e2e/mission-lifecycle.test.ts`
**Changes**: Add workflow progression tests

```typescript
test.describe('Simple Workflow Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    // Create and select a mission with simple workflow
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.getByTestId('new-mission-button').click();
    await page.locator('input#title').fill('Lifecycle Test');
    await page.locator('textarea#rawInput').fill('Test input for full lifecycle.');
    await page.locator('[data-testid="workflow-select"]').click();
    await page.getByRole('option', { name: /Simple/ }).click();
    await page.getByTestId('create-mission-btn').click();

    // Wait for mission to appear and select it
    await page.locator('[data-testid^="mission-item-"]').first().click();
    await expect(page.getByText('Mission: Lifecycle Test')).toBeVisible();
  });

  test('step 0: human reviews raw input and continues', async ({ page }) => {
    // Verify we're at step 0 (human-gate)
    await expect(page.getByTestId('status-badge-waiting_human')).toBeVisible();

    // Artifact editor should show raw input
    await expect(page.getByTestId('artifact-editor')).toBeVisible();
    await expect(page.getByTestId('artifact-editor')).toContainText('Test input for full lifecycle');

    // Click continue to approve
    await page.getByTestId('continue-btn').click();

    // Should transition to running agent (step 1)
    await expect(page.getByTestId('status-badge-running_code_agent')).toBeVisible({ timeout: 5000 });
  });

  test('step 1: agent executes and completes', async ({ page }) => {
    // Approve step 0
    await page.getByTestId('continue-btn').click();

    // Wait for agent to start
    await expect(page.getByTestId('status-badge-running_code_agent')).toBeVisible({ timeout: 5000 });

    // Log viewer should appear
    await expect(page.getByTestId('log-viewer')).toBeVisible();

    // Wait for agent to complete (mock agent takes ~2-3s)
    await expect(page.getByTestId('status-badge-waiting_human')).toBeVisible({ timeout: 15000 });

    // Should now be at step 2
    await expect(page.getByText('Current Step: Review')).toBeVisible();
  });

  test('step 2: human reviews output and completes mission', async ({ page }) => {
    // Progress through step 0
    await page.getByTestId('continue-btn').click();
    await expect(page.getByTestId('status-badge-running_code_agent')).toBeVisible({ timeout: 5000 });

    // Wait for step 1 to complete
    await expect(page.getByTestId('status-badge-waiting_human')).toBeVisible({ timeout: 15000 });

    // Verify output artifact content
    await expect(page.getByTestId('artifact-editor')).toContainText('Output from Process');

    // Complete the mission
    await page.getByTestId('continue-btn').click();

    // Mission should be completed
    await expect(page.getByTestId('status-badge-completed')).toBeVisible({ timeout: 5000 });
  });

  test('full lifecycle: create → human → agent → human → complete', async ({ page }) => {
    // This is the comprehensive end-to-end test

    // Step 0: Approve raw input
    await expect(page.getByTestId('artifact-editor')).toBeVisible();
    await page.getByTestId('continue-btn').click();

    // Step 1: Agent runs
    await expect(page.getByTestId('status-badge-running_code_agent')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('log-viewer')).toBeVisible();

    // Wait for agent completion
    await expect(page.getByTestId('status-badge-waiting_human')).toBeVisible({ timeout: 15000 });

    // Step 2: Review output and complete
    await expect(page.getByTestId('artifact-editor')).toBeVisible();
    await page.getByTestId('continue-btn').click();

    // Verify completion
    await expect(page.getByTestId('status-badge-completed')).toBeVisible({ timeout: 5000 });

    // Sidebar should also show completed status
    const sidebarItem = page.locator('[data-testid^="mission-item-"]').first();
    await expect(sidebarItem.getByTestId('status-badge-completed')).toBeVisible();
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] All lifecycle tests pass: `cd packages/frontend && pnpm exec playwright test mission-lifecycle.test.ts --project=chromium`
- [ ] Tests complete within reasonable time (< 30s per test)

#### Manual Verification:
- [ ] Watch test execution to verify UI state transitions look correct
- [ ] Verify Docker containers are being created and cleaned up

**Implementation Note**: After completing this phase, pause for verification before proceeding.

---

## Phase 4: Error Handling and Edge Cases

### Overview
Test artifact editing, multi-mission scenarios, and error states.

### Changes Required:

#### 1. Add Edge Case Tests
**File**: `packages/frontend/tests/e2e/mission-lifecycle.test.ts`
**Changes**: Add error handling and edge case tests

```typescript
test.describe('Artifact Editing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.getByTestId('new-mission-button').click();
    await page.locator('input#title').fill('Edit Test');
    await page.locator('textarea#rawInput').fill('Original content.');
    await page.locator('[data-testid="workflow-select"]').click();
    await page.getByRole('option', { name: /Simple/ }).click();
    await page.getByTestId('create-mission-btn').click();

    await page.locator('[data-testid^="mission-item-"]').first().click();
  });

  test('should enable save draft when content modified', async ({ page }) => {
    const editor = page.getByTestId('artifact-editor');

    // Save draft should be disabled initially
    await expect(page.getByTestId('save-draft-btn')).toBeDisabled();

    // Modify content
    await editor.fill('Modified content.');

    // Save draft should be enabled
    await expect(page.getByTestId('save-draft-btn')).toBeEnabled();
  });

  test('should persist changes after save draft', async ({ page }) => {
    const editor = page.getByTestId('artifact-editor');

    // Modify and save
    await editor.fill('Saved content.');
    await page.getByTestId('save-draft-btn').click();

    // Reload page
    await page.reload();
    await page.locator('[data-testid^="mission-item-"]').first().click();

    // Content should persist
    await expect(page.getByTestId('artifact-editor')).toHaveValue('Saved content.');
  });

  test('should switch between editor/diff/preview modes', async ({ page }) => {
    // Default is editor mode
    await expect(page.getByTestId('artifact-editor')).toBeVisible();

    // Switch to diff
    await page.getByRole('button', { name: 'Diff' }).click();
    await expect(page.getByText('No changes made')).toBeVisible();

    // Switch to preview
    await page.getByRole('button', { name: 'Preview' }).click();
    // Preview shows markdown rendered
    await expect(page.getByTestId('artifact-editor')).not.toBeVisible();

    // Switch back to editor
    await page.getByRole('button', { name: 'Editor' }).click();
    await expect(page.getByTestId('artifact-editor')).toBeVisible();
  });
});

test.describe('Multiple Missions', () => {
  test('should display multiple missions in sidebar', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Create first mission
    await page.getByTestId('new-mission-button').click();
    await page.locator('input#title').fill('Mission One');
    await page.locator('textarea#rawInput').fill('Content one.');
    await page.locator('[data-testid="workflow-select"]').click();
    await page.getByRole('option', { name: /Simple/ }).click();
    await page.getByTestId('create-mission-btn').click();
    await expect(page.getByText('Mission One')).toBeVisible({ timeout: 5000 });

    // Create second mission
    await page.getByTestId('new-mission-button').click();
    await page.locator('input#title').fill('Mission Two');
    await page.locator('textarea#rawInput').fill('Content two.');
    await page.locator('[data-testid="workflow-select"]').click();
    await page.getByRole('option', { name: /Simple/ }).click();
    await page.getByTestId('create-mission-btn').click();
    await expect(page.getByText('Mission Two')).toBeVisible({ timeout: 5000 });

    // Both should be in sidebar
    await expect(page.getByText('Mission One')).toBeVisible();
    await expect(page.getByText('Mission Two')).toBeVisible();
  });

  test('should switch between missions correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Create two missions
    await page.getByTestId('new-mission-button').click();
    await page.locator('input#title').fill('First Mission');
    await page.locator('textarea#rawInput').fill('First content.');
    await page.locator('[data-testid="workflow-select"]').click();
    await page.getByRole('option', { name: /Simple/ }).click();
    await page.getByTestId('create-mission-btn').click();
    await expect(page.getByText('First Mission')).toBeVisible({ timeout: 5000 });

    await page.getByTestId('new-mission-button').click();
    await page.locator('input#title').fill('Second Mission');
    await page.locator('textarea#rawInput').fill('Second content.');
    await page.locator('[data-testid="workflow-select"]').click();
    await page.getByRole('option', { name: /Simple/ }).click();
    await page.getByTestId('create-mission-btn').click();
    await expect(page.getByText('Second Mission')).toBeVisible({ timeout: 5000 });

    // Select first mission
    await page.getByText('First Mission').click();
    await expect(page.getByText('Mission: First Mission')).toBeVisible();
    await expect(page.getByTestId('artifact-editor')).toContainText('First content');

    // Select second mission
    await page.getByText('Second Mission').click();
    await expect(page.getByText('Mission: Second Mission')).toBeVisible();
    await expect(page.getByTestId('artifact-editor')).toContainText('Second content');
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] All tests pass: `cd packages/frontend && pnpm exec playwright test mission-lifecycle.test.ts --project=chromium`
- [ ] Full test suite runs without flakiness

#### Manual Verification:
- [ ] Test isolation works (missions from one test don't affect others)
- [ ] No orphaned Docker containers after test run

---

## Testing Strategy

### Unit Tests:
- Not applicable (E2E tests only)

### Integration Tests:
- The E2E tests serve as integration tests covering frontend ↔ backend ↔ Docker

### Manual Testing Steps:
1. Run full test suite: `cd packages/frontend && pnpm exec playwright test --project=chromium`
2. Check for orphaned containers: `docker ps -a --filter="label=haflow.mission_id"`
3. Verify test reports in `packages/frontend/playwright-report/`
4. Run with UI mode for debugging: `pnpm exec playwright test --ui`

## Performance Considerations

- Tests use 15s timeout for agent completion (mock agent takes ~2-3s)
- Frontend polling at 500ms during agent execution ensures quick state updates
- Sequential test execution (`fullyParallel: false`) prevents race conditions
- Global setup/teardown handles isolation

## Migration Notes

N/A - New tests, no existing behavior to migrate.

## References

- Original research: `thoughts/shared/research/2026-01-24-e2e-test-planning.md`
- Simple workflow: `packages/backend/src/services/workflow.ts:19-27`
- Mock agent: `packages/backend/src/services/mission-engine.ts:221-256`
- Playwright config: `packages/frontend/playwright.config.ts`
- Existing E2E tests: `packages/frontend/tests/e2e/home.test.ts`
