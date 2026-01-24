# Workflow History Navigation Implementation Plan

## Overview

Implement the ability for users to click on completed workflow steps in the timeline and view their inputs/outputs in a read-only modal. This is a frontend-only feature since the backend already provides all necessary data.

## Current State Analysis

### What Exists
- **Backend**: Complete step execution history in `runs/`, all artifacts in `artifacts/` directory
- **API**: `GET /api/missions/:id` returns full workflow, all runs, and all artifacts in single response
- **Frontend**: WorkflowTimeline is display-only; ActivityHistory shows run metadata but no artifact viewing

### Key Files
- `packages/frontend/src/components/MissionDetail.tsx:30-76` - WorkflowTimeline (display only)
- `packages/frontend/src/components/MissionDetail.tsx:189-397` - MissionDetail main component
- `packages/frontend/src/components/ui/dialog.tsx` - Existing Dialog component
- `packages/frontend/src/components/NewMissionModal.tsx` - Pattern to follow for modal state

### Data Already Available
Each step in `mission.workflow.steps` has:
- `inputArtifact`: filename of input (e.g., `"raw-input.md"`)
- `outputArtifact`: filename of output (e.g., `"structured-text.md"`)
- `reviewArtifact`: for human-gate steps

All artifacts are available in `mission.artifacts[filename]`.

## Desired End State

After implementation:
1. Completed step circles in WorkflowTimeline are clickable with visual hover feedback
2. Clicking a completed step opens a modal showing:
   - Step name and execution metadata (timestamp, duration)
   - Input artifact (read-only, left side)
   - Output artifact (read-only, right side)
3. Modal has proper data-testid attributes for E2E testing
4. Responsive design: stacked layout on mobile, side-by-side on desktop

### Verification
- Clicking a completed step circle opens the modal
- Modal displays correct input and output artifacts for the selected step
- Modal is read-only (no edit controls)
- Modal closes when clicking X or outside
- Clicking current/future steps does nothing
- Works on mobile with stacked layout

## What We're NOT Doing

- **No log access for historical runs** - Would require new API endpoint (`GET /api/missions/:id/runs/:runId/log`)
- **No diff view** - Before/after comparison can be added later
- **No editing of historical artifacts** - Strictly read-only
- **No new API endpoints** - This is frontend-only
- **No changes to ActivityHistory component** - Entry point is timeline only

## Implementation Approach

Use existing Dialog component with modal state managed in MissionDetail. Create a new `StepHistoryModal` component that receives step data and artifacts, displaying them in a split (desktop) or stacked (mobile) read-only view.

---

## Phase 1: Create StepHistoryModal Component

### Overview
Create a new modal component that displays historical step details with input/output artifacts in a split view.

### Changes Required:

#### 1. Create StepHistoryModal Component
**File**: `packages/frontend/src/components/StepHistoryModal.tsx`

```typescript
import * as React from 'react'
import type { WorkflowStep, StepRun } from '@haflow/shared'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

interface StepHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  step: WorkflowStep | null
  stepIndex: number
  artifacts: Record<string, string>
  runs: StepRun[]
}

export function StepHistoryModal({
  isOpen,
  onClose,
  step,
  stepIndex,
  artifacts,
  runs,
}: StepHistoryModalProps) {
  if (!step) return null

  // Find runs for this step
  const stepRuns = runs.filter((r) => r.step_id === step.step_id)
  const latestRun = stepRuns[stepRuns.length - 1]

  // Determine input and output artifact names
  const inputArtifactName = step.inputArtifact
  const outputArtifactName = step.type === 'human-gate'
    ? step.reviewArtifact
    : step.outputArtifact

  const inputContent = inputArtifactName ? artifacts[inputArtifactName] : null
  const outputContent = outputArtifactName ? artifacts[outputArtifactName] : null

  // Format duration if available
  const formatDuration = (run: StepRun | undefined) => {
    if (!run?.started_at || !run?.finished_at) return null
    const start = new Date(run.started_at)
    const end = new Date(run.finished_at)
    const diffMs = end.getTime() - start.getTime()
    const seconds = Math.floor(diffMs / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m ${seconds % 60}s`
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        data-testid="step-history-modal"
        className="max-w-4xl max-h-[85vh] flex flex-col"
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle data-testid="step-history-title">
              Step {stepIndex + 1}: {step.name}
            </DialogTitle>
            <Badge variant="outline" data-testid="step-type-badge">
              {step.type}
            </Badge>
          </div>
          {latestRun && (
            <DialogDescription data-testid="step-execution-info">
              Completed {new Date(latestRun.finished_at!).toLocaleString()}
              {formatDuration(latestRun) && ` (${formatDuration(latestRun)})`}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Artifact Display - Split on desktop, stacked on mobile */}
        <div
          data-testid="step-artifacts-container"
          className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0 overflow-hidden"
        >
          {/* Input Artifact */}
          {inputArtifactName && (
            <Card className="flex flex-col overflow-hidden">
              <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span>Input: {inputArtifactName}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-0 overflow-hidden">
                <ScrollArea className="h-full max-h-[300px] md:max-h-[400px]">
                  <div className="p-4">
                    {inputContent ? (
                      inputArtifactName.endsWith('.json') ? (
                        <pre
                          data-testid="input-artifact-content"
                          className="font-mono text-sm whitespace-pre-wrap"
                        >
                          {inputContent}
                        </pre>
                      ) : (
                        <div
                          data-testid="input-artifact-content"
                          className="prose prose-sm dark:prose-invert max-w-none"
                        >
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {inputContent}
                          </ReactMarkdown>
                        </div>
                      )
                    ) : (
                      <p className="text-muted-foreground italic">
                        No input artifact
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Output Artifact */}
          {outputArtifactName && (
            <Card className="flex flex-col overflow-hidden">
              <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-sm font-medium">
                  Output: {outputArtifactName}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-0 overflow-hidden">
                <ScrollArea className="h-full max-h-[300px] md:max-h-[400px]">
                  <div className="p-4">
                    {outputContent ? (
                      outputArtifactName.endsWith('.json') ? (
                        <pre
                          data-testid="output-artifact-content"
                          className="font-mono text-sm whitespace-pre-wrap"
                        >
                          {outputContent}
                        </pre>
                      ) : (
                        <div
                          data-testid="output-artifact-content"
                          className="prose prose-sm dark:prose-invert max-w-none"
                        >
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {outputContent}
                          </ReactMarkdown>
                        </div>
                      )
                    ) : (
                      <p className="text-muted-foreground italic">
                        No output artifact
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Handle human-gate steps with only reviewArtifact */}
          {!inputArtifactName && !outputArtifactName && step.reviewArtifact && (
            <Card className="flex flex-col overflow-hidden md:col-span-2">
              <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-sm font-medium">
                  Review: {step.reviewArtifact}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-0 overflow-hidden">
                <ScrollArea className="h-full max-h-[400px]">
                  <div className="p-4">
                    {artifacts[step.reviewArtifact] ? (
                      <div
                        data-testid="review-artifact-content"
                        className="prose prose-sm dark:prose-invert max-w-none"
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {artifacts[step.reviewArtifact]}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-muted-foreground italic">
                        No review artifact
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm --filter frontend build`
- [x] Linting passes: `pnpm --filter frontend lint`

#### Manual Verification:
- [ ] Component renders without errors when imported
- [ ] Modal displays correctly with test data

---

## Phase 2: Make WorkflowTimeline Steps Clickable

### Overview
Modify the WorkflowTimeline component to make completed step circles clickable with visual feedback.

### Changes Required:

#### 1. Update WorkflowTimeline Component
**File**: `packages/frontend/src/components/MissionDetail.tsx`

**Location**: Lines 30-76 (WorkflowTimeline function)

**Changes**:
1. Add `onStepClick` prop
2. Add cursor and hover styles for completed steps
3. Add click handler that calls `onStepClick` for completed steps only

```typescript
function WorkflowTimeline({
  steps,
  currentStep,
  onStepClick,
}: {
  steps: MissionDetailType['workflow']['steps']
  currentStep: number
  onStepClick?: (stepIndex: number) => void
}) {
  return (
    <div data-testid="workflow-timeline" className="flex items-center gap-1 py-4 px-4 md:px-6 overflow-x-auto">
      {steps.map((step, i: number) => {
        const isCompleted = i < currentStep
        const isCurrent = i === currentStep
        const isClickable = isCompleted && onStepClick

        return (
          <div key={step.step_id} data-testid={`workflow-step-${i}`} className="flex items-center">
            {/* Step Circle */}
            <div className="flex flex-col items-center">
              <button
                type="button"
                data-testid={`workflow-step-circle-${i}`}
                onClick={() => isClickable && onStepClick(i)}
                disabled={!isClickable}
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-all',
                  isCompleted
                    ? 'bg-primary border-primary text-primary-foreground'
                    : isCurrent
                    ? 'bg-background border-primary text-primary'
                    : 'bg-background border-muted text-muted-foreground',
                  isClickable && 'cursor-pointer hover:ring-2 hover:ring-ring hover:ring-offset-2'
                )}
                aria-label={isClickable ? `View step ${i + 1}: ${step.name}` : undefined}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : i + 1}
              </button>
              <span
                className={cn(
                  'mt-1 text-xs whitespace-nowrap',
                  isCurrent ? 'text-foreground font-medium' : 'text-muted-foreground'
                )}
              >
                {step.name}
              </span>
            </div>
            {/* Connector Line */}
            {i < steps.length - 1 && (
              <div
                className={cn(
                  'w-12 h-0.5 mx-1',
                  isCompleted ? 'bg-primary' : 'bg-muted'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm --filter frontend build`
- [x] Linting passes: `pnpm --filter frontend lint`

#### Manual Verification:
- [ ] Completed step circles show pointer cursor on hover
- [ ] Completed step circles show ring effect on hover
- [ ] Current and future step circles are not clickable
- [ ] Accessibility: button has aria-label for screen readers

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Wire Up Modal to MissionDetail

### Overview
Add state management to MissionDetail to track selected history step and connect the modal.

### Changes Required:

#### 1. Update MissionDetail Component
**File**: `packages/frontend/src/components/MissionDetail.tsx`

**Location**: Lines 189-397

**Changes**:
1. Add import for StepHistoryModal
2. Add `selectedHistoryStepIndex` state
3. Create handler for step clicks
4. Pass `onStepClick` to WorkflowTimeline
5. Render StepHistoryModal with selected step data

**Add import at top of file (after existing imports):**
```typescript
import { StepHistoryModal } from './StepHistoryModal'
```

**Add state inside MissionDetail function (after line 193):**
```typescript
const [selectedHistoryStepIndex, setSelectedHistoryStepIndex] = useState<number | null>(null)

const handleHistoryStepClick = (stepIndex: number) => {
  setSelectedHistoryStepIndex(stepIndex)
}

const handleCloseHistoryModal = () => {
  setSelectedHistoryStepIndex(null)
}

const selectedHistoryStep = selectedHistoryStepIndex !== null
  ? mission.workflow.steps[selectedHistoryStepIndex]
  : null
```

**Update WorkflowTimeline usage (around line 240):**
```typescript
<WorkflowTimeline
  steps={mission.workflow.steps}
  currentStep={mission.current_step}
  onStepClick={handleHistoryStepClick}
/>
```

**Add modal before closing div of component (before line 396):**
```typescript
{/* Step History Modal */}
<StepHistoryModal
  isOpen={selectedHistoryStepIndex !== null}
  onClose={handleCloseHistoryModal}
  step={selectedHistoryStep}
  stepIndex={selectedHistoryStepIndex ?? 0}
  artifacts={mission.artifacts}
  runs={mission.runs}
/>
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm --filter frontend build`
- [x] Linting passes: `pnpm --filter frontend lint`
- [ ] Frontend dev server runs without errors: `pnpm --filter frontend dev`

#### Manual Verification:
- [ ] Clicking a completed step circle opens the modal
- [ ] Modal shows correct step name and index
- [ ] Modal displays input artifact on left
- [ ] Modal displays output artifact on right
- [ ] Modal closes when clicking X button
- [ ] Modal closes when clicking outside
- [ ] Clicking current/future steps does nothing
- [ ] On mobile: artifacts stack vertically
- [ ] Content scrolls properly within each artifact card

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Add E2E Tests

### Overview
Add Playwright E2E tests for the new workflow history navigation feature.

### Changes Required:

#### 1. Add E2E Test for Step History Modal
**File**: `packages/frontend/tests/e2e/step-history.spec.ts` (new file)

```typescript
import { test, expect } from '@playwright/test'

test.describe('Workflow Step History Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto('/')
    // Wait for missions to load
    await page.waitForSelector('[data-testid="mission-list"]')
  })

  test('completed step circles are clickable', async ({ page }) => {
    // This test requires a mission with at least one completed step
    // For now, we'll check that the timeline renders
    const timeline = page.getByTestId('workflow-timeline')
    await expect(timeline).toBeVisible()

    // Check that step circles exist
    const stepCircle = page.getByTestId('workflow-step-circle-0')
    await expect(stepCircle).toBeVisible()
  })

  test('clicking completed step opens history modal', async ({ page }) => {
    // Select a mission from the list (if available)
    const missionItems = page.getByTestId(/^mission-item-/)
    const count = await missionItems.count()

    if (count > 0) {
      await missionItems.first().click()

      // Wait for mission detail to load
      await page.waitForSelector('[data-testid="workflow-timeline"]')

      // Try to find a completed step (one that's before current_step)
      // This is step 0 if mission is past first step
      const stepCircle = page.getByTestId('workflow-step-circle-0')

      // Check if step is completed (has checkmark or specific styling)
      // If the step is clickable, click it
      const isClickable = await stepCircle.evaluate((el) => {
        return !el.hasAttribute('disabled')
      })

      if (isClickable) {
        await stepCircle.click()

        // Verify modal opens
        const modal = page.getByTestId('step-history-modal')
        await expect(modal).toBeVisible()

        // Verify modal has expected content
        await expect(page.getByTestId('step-history-title')).toBeVisible()
        await expect(page.getByTestId('step-artifacts-container')).toBeVisible()
      }
    }
  })

  test('step history modal closes on backdrop click', async ({ page }) => {
    // Select a mission and open history modal (if possible)
    const missionItems = page.getByTestId(/^mission-item-/)
    const count = await missionItems.count()

    if (count > 0) {
      await missionItems.first().click()
      await page.waitForSelector('[data-testid="workflow-timeline"]')

      const stepCircle = page.getByTestId('workflow-step-circle-0')
      const isClickable = await stepCircle.evaluate((el) => !el.hasAttribute('disabled'))

      if (isClickable) {
        await stepCircle.click()

        // Wait for modal
        const modal = page.getByTestId('step-history-modal')
        await expect(modal).toBeVisible()

        // Click outside modal to close
        await page.mouse.click(10, 10)

        // Verify modal closed
        await expect(modal).not.toBeVisible()
      }
    }
  })
})
```

### Success Criteria:

#### Automated Verification:
- [x] E2E tests compile: `pnpm --filter frontend build`
- [x] E2E tests lint: `pnpm --filter frontend exec eslint tests/e2e/step-history.test.ts`
- [ ] E2E tests pass: `pnpm --filter frontend test:e2e` (requires backend running)

#### Manual Verification:
- [ ] Test file is properly discovered by Playwright
- [ ] Tests provide meaningful coverage for the feature

---

## Testing Strategy

### Unit Tests:
- StepHistoryModal renders correctly with different step types (agent, human-gate)
- StepHistoryModal handles missing artifacts gracefully
- WorkflowTimeline click handler only fires for completed steps

### Integration Tests:
- Full flow: click step → modal opens → displays correct artifacts → close modal

### Manual Testing Steps:
1. Create a new mission and advance it past the first step
2. Click on completed step 1 in the timeline
3. Verify modal shows correct input/output for step 1
4. Close modal by clicking X
5. Close modal by clicking outside
6. Verify current/future steps are not clickable
7. Test on mobile viewport (stacked layout)

## Performance Considerations

- No new API calls required - all data already fetched in `getMission`
- Modal content renders only when opened (controlled by `isOpen`)
- ScrollArea used for artifact content to handle large files
- React Markdown renders on-demand within scroll containers

## Migration Notes

None required - this is a new feature with no breaking changes.

## References

- Original ticket: `thoughts/shared/draft/buttons.md`
- Research document: `thoughts/shared/research/2026-01-24-workflow-history-navigation.md`
- Modal pattern: `packages/frontend/src/components/NewMissionModal.tsx`
- Dialog component: `packages/frontend/src/components/ui/dialog.tsx`
