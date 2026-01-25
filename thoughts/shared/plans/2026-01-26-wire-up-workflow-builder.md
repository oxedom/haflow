# Wire Up WorkflowBuilder Component - Implementation Plan

## Overview

Connect the fully-implemented `WorkflowBuilder` component to the main application, enabling users to access the visual workflow editor and execute custom workflows by creating missions. This is session-only (no persistence) but designed to allow future persistence.

## Current State Analysis

**What exists:**
- `WorkflowBuilder` component fully implemented (`packages/frontend/src/components/workflow/WorkflowBuilder.tsx`)
- ReactFlow canvas, drag-and-drop nodes, configuration panels, validation
- `onSave` and `onExecute` callbacks defined but not wired
- `NewMissionModal` with workflow dropdown (fetches from API)
- Backend `GET /api/workflows` returns hardcoded workflows only

**What's missing:**
- No navigation to access WorkflowBuilder
- No state in App.tsx to show WorkflowBuilder
- No way to pass custom workflow to NewMissionModal

### Key Discoveries:
- `App.tsx:31-36` uses state variables for view switching (`selectedMissionId`, `showVoiceChat`)
- `Sidebar.tsx:93-104` pattern for action buttons
- `NewMissionModal.tsx:66-70` fetches workflows on open, stores in local state
- `WorkflowBuilder` expects `onSave` and `onExecute` callbacks (`WorkflowBuilder.tsx:21-25`)

## Desired End State

After implementation:
1. User sees "Create Workflow" button in sidebar
2. Clicking it shows the WorkflowBuilder in the main content area
3. User can design a workflow with drag-and-drop nodes
4. Clicking "Execute" validates the workflow, then opens NewMissionModal
5. NewMissionModal shows the custom workflow as an option (pre-selected)
6. User fills in mission details and creates mission with custom workflow

### Verification:
- Manual: Navigate to WorkflowBuilder, add nodes, connect them, click Execute, see NewMissionModal with custom workflow selected

## What We're NOT Doing

- **No workflow persistence** - Custom workflows are session-only (future work)
- **No workflow list view** - Just the builder for now
- **No backend changes** - Mission creation already accepts any workflow structure
- **No "Save" functionality** - Save button will be no-op with console log (placeholder for future)

## Implementation Approach

0. **Backend**: Add support for inline workflows in mission creation (small change)
1. Add state and navigation in `App.tsx` to show WorkflowBuilder
2. Add "Create Workflow" button to `Sidebar.tsx`
3. Modify `NewMissionModal` to accept a custom workflow prop
4. Wire up the execute flow: WorkflowBuilder → NewMissionModal → Mission creation

## Phase 0: Backend Support for Inline Workflows

### Overview
Enable mission creation to accept an inline workflow object (not just workflowId). This is required because custom workflows don't exist in the hardcoded workflow list.

### Changes Required:

#### 1. Shared Schema - Add workflow to CreateMissionRequest
**File**: `packages/shared/src/schemas.ts`
**Changes**: Accept optional `workflow` object in CreateMissionRequest

```typescript
// Update CreateMissionRequestSchema (around line 95)
export const CreateMissionRequestSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  type: MissionTypeSchema,
  rawInput: z.string().min(1, 'Raw input is required'),
  workflowId: z.string().optional(),
  workflow: WorkflowSchema.optional(),  // Add inline workflow support
});
```

#### 2. Shared Schema - Add workflow storage to MissionMeta
**File**: `packages/shared/src/schemas.ts`
**Changes**: Store inline workflow in mission metadata

```typescript
// Update MissionMetaSchema (around line 44)
export const MissionMetaSchema = z.object({
  mission_id: z.string(),
  title: z.string(),
  type: MissionTypeSchema,
  workflow_id: z.string(),
  workflow: WorkflowSchema.optional(),  // Store inline workflow if provided
  current_step: z.number(),
  status: MissionStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
  errors: z.array(z.string()),
  last_error: z.string().optional(),
});
```

#### 3. Backend Mission Store - Accept inline workflow
**File**: `packages/backend/src/services/mission-store.ts`
**Changes**: Accept and store inline workflow

```typescript
// Update createMission function signature (around line 36)
async function createMission(
  title: string,
  type: MissionType,
  rawInput: string,
  workflowId?: string,
  workflow?: Workflow  // Add this parameter
): Promise<MissionMeta> {
  const missionId = generateMissionId();
  const now = new Date().toISOString();

  // Resolve workflow: use provided workflow, or look up by ID, or use default
  const resolvedWorkflow = workflow || getWorkflowById(workflowId || '') || getDefaultWorkflow();
  const resolvedWorkflowId = workflowId || workflow?.workflow_id || getDefaultWorkflowId();

  // Determine initial status based on first step type
  const firstStep = resolvedWorkflow.steps[0];
  const initialStatus: MissionStatus = firstStep?.type === 'human-gate'
    ? 'waiting_human'
    : 'ready';

  const meta: MissionMeta = {
    mission_id: missionId,
    title,
    type,
    workflow_id: resolvedWorkflowId,
    workflow: workflow,  // Store inline workflow if provided
    current_step: 0,
    status: initialStatus,
    created_at: now,
    updated_at: now,
    errors: [],
  };
  // ... rest unchanged
}
```

#### 4. Backend Mission Store - Use stored workflow in getDetail
**File**: `packages/backend/src/services/mission-store.ts`
**Changes**: Prefer stored inline workflow over lookup

```typescript
// Update getDetail function (around line 88)
async function getDetail(missionId: string): Promise<MissionDetail | null> {
  const meta = await getMeta(missionId);
  if (!meta) return null;

  // Prefer stored inline workflow, then lookup by ID, then default
  const workflow = meta.workflow || getWorkflowById(meta.workflow_id) || getDefaultWorkflow();
  const artifacts = await loadArtifacts(missionId);
  const runs = await loadRuns(missionId);
  const currentLogTail = await getCurrentLogTail(missionId, runs);

  return {
    ...meta,
    workflow,
    artifacts,
    runs,
    current_log_tail: currentLogTail,
  };
}
```

#### 5. Backend Routes - Pass workflow to createMission
**File**: `packages/backend/src/routes/missions.ts`
**Changes**: Extract and pass workflow from request

```typescript
// Update POST /api/missions handler (around line 115)
const { title, type, rawInput, workflowId, workflow } = parsed.data;
const meta = await missionStore.createMission(title, type, rawInput, workflowId, workflow);
```

#### 6. Frontend API Client - Send workflow in request
**File**: `packages/frontend/src/api/client.ts`
**Changes**: Accept and send workflow in createMission

```typescript
// Update createMission in api object
createMission: async (
  title: string,
  type: 'feature' | 'fix' | 'bugfix',
  rawInput: string,
  workflowId: string,
  workflow?: Workflow  // Add optional workflow
): Promise<MissionMeta> => {
  const res = await fetch(`${BASE_URL}/missions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, type, rawInput, workflowId, workflow }),
  })
  // ... rest unchanged
}
```

### Success Criteria:

#### Automated Verification:
- [x] Shared package builds: `pnpm --filter @haflow/shared build`
- [x] Backend builds: `pnpm --filter @haflow/backend build`
- [x] Backend tests pass: `pnpm --filter @haflow/backend test`
- [x] Frontend builds: `pnpm --filter frontend build`

#### Manual Verification:
- [ ] Can still create missions with workflowId (existing flow works)
- [ ] Can create mission with inline workflow via API (curl test)

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 1.

---

## Phase 1: Add WorkflowBuilder State and Navigation

### Overview
Enable navigation to WorkflowBuilder and render it in the main content area.

### Changes Required:

#### 1. App.tsx - Add state and rendering
**File**: `packages/frontend/src/App.tsx`
**Changes**: Add state for workflow builder visibility, import WorkflowBuilder, add conditional rendering

```tsx
// Add imports (around line 7)
import WorkflowBuilder from '@/components/workflow/WorkflowBuilder'
import type { Workflow } from '@haflow/shared'

// Add state (after line 36)
const [showWorkflowBuilder, setShowWorkflowBuilder] = useState(false)
const [customWorkflow, setCustomWorkflow] = useState<Workflow | null>(null)

// Add handlers (after handleMarkCompleted around line 182)
const handleShowWorkflowBuilder = () => {
  setShowWorkflowBuilder(true)
  setSelectedMissionId(null)  // Deselect mission
  setShowVoiceChat(false)     // Hide voice chat
}

const handleSaveWorkflow = async (workflow: Workflow) => {
  // Placeholder for future persistence
  console.log('Workflow save not yet implemented:', workflow)
}

const handleExecuteWorkflow = async (workflow: Workflow) => {
  setCustomWorkflow(workflow)
  setShowWorkflowBuilder(false)
  setIsNewMissionModalOpen(true)
}

const handleCloseWorkflowBuilder = () => {
  setShowWorkflowBuilder(false)
}
```

Update Sidebar props (around line 225):
```tsx
<Sidebar
  missions={missions}
  selectedMissionId={selectedMissionId}
  onSelectMission={handleSelectMission}
  onNewMission={handleNewMission}
  onCreateWorkflow={handleShowWorkflowBuilder}  // Add this
  isOpen={isSidebarOpen}
  onClose={() => setIsSidebarOpen(false)}
/>
```

Update main content area conditional (around line 267):
```tsx
{/* Main Content Area */}
<div className="flex-1 min-h-0">
  {showWorkflowBuilder ? (
    <WorkflowBuilder
      onSave={handleSaveWorkflow}
      onExecute={handleExecuteWorkflow}
    />
  ) : showVoiceChat ? (
    <ChatVoice ... />
  ) : selectedMission ? (
    <MissionDetailView ... />
  ) : (
    <div className="h-full flex items-center justify-center">
      ...
    </div>
  )}
</div>
```

Update NewMissionModal props (around line 297):
```tsx
<NewMissionModal
  isOpen={isNewMissionModalOpen}
  onClose={() => {
    setIsNewMissionModalOpen(false)
    setCustomWorkflow(null)  // Clear custom workflow on close
  }}
  onSubmit={handleCreateMission}
  customWorkflow={customWorkflow}  // Add this
/>
```

#### 2. Sidebar.tsx - Add Create Workflow button
**File**: `packages/frontend/src/components/Sidebar.tsx`
**Changes**: Add button and prop for workflow creation

```tsx
// Add import (around line 2)
import { Plus, X, GitBranch } from 'lucide-react'

// Update interface (around line 9)
interface SidebarProps {
  missions: MissionListItem[]
  selectedMissionId: string | null
  onSelectMission: (id: string) => void
  onNewMission: () => void
  onCreateWorkflow: () => void  // Add this
  isOpen: boolean
  onClose: () => void
}

// Update function signature (around line 49)
export function Sidebar({ missions, selectedMissionId, onSelectMission, onNewMission, onCreateWorkflow, isOpen, onClose }: SidebarProps)

// Add button after New Mission button (after line 104)
<Button
  onClick={onCreateWorkflow}
  variant="ghost"
  className="w-full justify-start"
  data-testid="create-workflow-button"
>
  <GitBranch className="mr-2 h-4 w-4" />
  Create Workflow
</Button>
```

### Success Criteria:

#### Automated Verification:
- [x] Build passes: `pnpm --filter frontend build`
- [ ] Lint passes: `pnpm --filter frontend lint` (pre-existing lint errors not related to this change)
- [ ] TypeScript types check: `pnpm --filter frontend typecheck` (if available)

#### Manual Verification:
- [ ] "Create Workflow" button visible in sidebar
- [ ] Clicking it shows WorkflowBuilder in main content
- [ ] Can add nodes via drag-and-drop
- [ ] Can connect nodes
- [ ] Clicking a mission in sidebar exits workflow builder and shows mission

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Wire Up Execute Flow

### Overview
Connect WorkflowBuilder's Execute action to NewMissionModal with the custom workflow pre-selected.

### Changes Required:

#### 1. NewMissionModal.tsx - Accept custom workflow
**File**: `packages/frontend/src/components/NewMissionModal.tsx`
**Changes**: Accept `customWorkflow` prop and integrate it into workflow selection

```tsx
// Update interface (around line 25)
interface NewMissionModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (
    title: string,
    type: 'feature' | 'fix' | 'bugfix',
    rawInput: string,
    workflowId: string
  ) => void
  customWorkflow?: Workflow | null  // Add this
}

// Update function signature (around line 36)
export function NewMissionModal({ isOpen, onClose, onSubmit, customWorkflow }: NewMissionModalProps)

// Update useEffect for workflows (around line 59)
useEffect(() => {
  if (isOpen) {
    // Generate a random title when modal opens
    if (!title) {
      regenerateTitle()
    }

    api.getWorkflows().then((wfs) => {
      // If custom workflow provided, add it to the list
      if (customWorkflow) {
        const allWorkflows = [customWorkflow, ...wfs]
        setWorkflows(allWorkflows)
        setWorkflowId(customWorkflow.workflow_id)
      } else {
        setWorkflows(wfs)
        // Only set default on first load
        setWorkflowId((prev) => prev || (wfs.length > 0 ? wfs[0].workflow_id : ''))
      }
    })
  }
}, [isOpen, title, regenerateTitle, customWorkflow])
```

The custom workflow will appear first in the dropdown with "(Custom)" appended to its name for clarity. Update the Select display (around line 137):

```tsx
<SelectContent>
  {workflows.map((wf, index) => (
    <SelectItem key={wf.workflow_id} value={wf.workflow_id}>
      {wf.name} ({wf.steps.length} steps){customWorkflow && index === 0 ? ' - Custom' : ''}
    </SelectItem>
  ))}
</SelectContent>
```

#### 2. App.tsx - Pass custom workflow to handleCreateMission
**File**: `packages/frontend/src/App.tsx`
**Changes**: When creating mission with custom workflow, pass the full workflow object

The existing flow already works because:
- `handleCreateMission` receives `workflowId`
- Backend `createMission` accepts `workflowId`
- For custom workflows, we need to pass the workflow object to the backend

**Check backend**: The backend `createMission` should accept either a `workflowId` (for built-in) or inline `workflow` object (for custom). Let me verify this is supported.

If backend doesn't support inline workflows, we have two options:
1. **Quick fix**: Use a temporary ID and store workflow in session state
2. **Proper fix**: Update backend to accept inline workflow

For session-only approach, the **quick fix** works:
- Generate a unique ID for custom workflow (e.g., `custom-<timestamp>`)
- Store it in App.tsx state
- Pass the ID to NewMissionModal
- When creating mission, if it's a custom workflow ID, send the full workflow object

Actually, looking at the backend mission creation (`packages/backend/src/routes/missions.ts`), it likely just stores `workflowId`. We need to verify if the mission engine can accept an inline workflow.

**Alternative simpler approach**:
Since this is session-only, we can store custom workflows in browser sessionStorage keyed by their generated ID, and the backend can be updated later to support custom workflows.

For now, let's use the simplest approach that works:
- Custom workflows get a generated ID like `custom-{uuid}`
- We pass the workflow to the backend as part of mission creation
- Backend stores the workflow inline in the mission JSON

Let me check backend mission creation to confirm this approach.

### Success Criteria:

#### Automated Verification:
- [x] Build passes: `pnpm --filter frontend build`
- [x] Backend build passes: `pnpm --filter @haflow/backend build`
- [x] All tests pass: `pnpm --filter @haflow/backend test`

#### Manual Verification:
- [ ] Open WorkflowBuilder, add nodes, click Execute
- [ ] NewMissionModal opens with custom workflow pre-selected
- [ ] "Custom" label visible next to workflow name
- [ ] Fill in mission details, click Create
- [ ] Mission is created and visible in sidebar
- [ ] Mission uses the custom workflow (check step names)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Handle Edge Cases and Polish

### Overview
Handle edge cases like unsaved changes warning, clear workflow state, and ensure smooth UX.

### Changes Required:

#### 1. Add unsaved changes warning
**File**: `packages/frontend/src/App.tsx`
**Changes**: Warn user when navigating away from WorkflowBuilder with unsaved changes

The `WorkflowBuilder` component already has `isDirty` state tracking. We need to:
1. Pass a callback to WorkflowBuilder to check for unsaved changes before navigation
2. Or handle this in the navigation handlers

Simpler approach - use a callback pattern:

```tsx
// In App.tsx handlers
const handleSelectMission = (id: string) => {
  if (showWorkflowBuilder) {
    // WorkflowBuilder handles its own dirty state warning via handleClear
    // For navigation, we just switch - the component already prompts on clear
  }
  setShowWorkflowBuilder(false)
  setSelectedMissionId(id)
  setIsSidebarOpen(false)
}
```

Actually, the WorkflowBuilder already handles dirty state in `handleClear` but not for external navigation. For MVP, we can skip the warning on navigation and add it later.

#### 2. Reset state on modal close
**File**: `packages/frontend/src/App.tsx`
**Changes**: Ensure `customWorkflow` is cleared when modal closes

Already handled in Phase 2:
```tsx
onClose={() => {
  setIsNewMissionModalOpen(false)
  setCustomWorkflow(null)
}}
```

#### 3. Add loading state for workflow builder
If needed, add a loading indicator while WorkflowBuilder initializes.

### Success Criteria:

#### Automated Verification:
- [x] Build passes: `pnpm --filter frontend build`
- [ ] Lint passes: `pnpm --filter frontend lint` (pre-existing lint errors not related to this change)

#### Manual Verification:
- [ ] Workflow state is cleared when switching views
- [ ] Custom workflow is cleared when modal is closed
- [ ] No console errors during normal usage flow

---

## Testing Strategy

### Unit Tests:
- None required for this MVP - changes are primarily wiring/integration

### Integration Tests:
- Could add Playwright test for full flow (future)

### Manual Testing Steps:
1. Start frontend: `pnpm --filter frontend dev`
2. Start backend: `pnpm --filter @haflow/backend dev`
3. Click "Create Workflow" in sidebar
4. Verify WorkflowBuilder appears
5. Drag an Agent node onto canvas
6. Configure the node (click to select, fill in panel)
7. Add a Human Gate node
8. Connect Agent → Human Gate
9. Click "Execute"
10. Verify NewMissionModal opens
11. Verify custom workflow is selected
12. Fill in title and raw input
13. Click "Create Mission"
14. Verify mission appears in sidebar
15. Click mission to view details
16. Verify workflow steps match what was designed

## Performance Considerations

- ReactFlow is already lazy-loaded via the component
- No additional performance concerns for this change

## Future Enhancements (Out of Scope)

1. **Workflow persistence**: Add `POST /api/workflows` endpoint, store in `~/.haflow/workflows/`
2. **Workflow list view**: Show saved workflows with edit/delete options
3. **Import/Export**: Allow sharing workflows as JSON files
4. **Template workflows**: Pre-populate builder with common patterns

## References

- Research document: `thoughts/shared/research/2026-01-25-workflow-creator-page-missing.md`
- WorkflowBuilder component: `packages/frontend/src/components/workflow/WorkflowBuilder.tsx`
- App.tsx (main): `packages/frontend/src/App.tsx`
- Sidebar: `packages/frontend/src/components/Sidebar.tsx`
- NewMissionModal: `packages/frontend/src/components/NewMissionModal.tsx`
