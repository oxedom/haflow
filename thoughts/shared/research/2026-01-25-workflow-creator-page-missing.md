---
date: 2026-01-25T23:54:09+02:00
researcher: Claude
git_commit: 44ec565b3abedd307800b603680f378336bad0ae
branch: feat/workflow
repository: haflow
topic: "Workflow Creator Page Not Accessible - Missing Navigation and Backend Integration"
tags: [research, codebase, workflow, frontend, navigation, react-flow]
status: complete
last_updated: 2026-01-25
last_updated_by: Claude
---

# Research: Workflow Creator Page Not Accessible

**Date**: 2026-01-25T23:54:09+02:00
**Researcher**: Claude
**Git Commit**: 44ec565b3abedd307800b603680f378336bad0ae
**Branch**: feat/workflow
**Repository**: haflow

## Research Question

User cannot find the workflow creator page - where is it and why isn't it accessible?

## Summary

The **WorkflowBuilder component is fully implemented** but **completely disconnected from the application**. There is:

1. ❌ No navigation/button to access it in the UI
2. ❌ No view state in `App.tsx` to render it
3. ❌ No backend API to persist custom workflows (save is a no-op placeholder)
4. ⚠️ Workflows are hardcoded in backend (`raw-research-plan-implement`, `oneshot`)

## Detailed Findings

### WorkflowBuilder Component (FULLY BUILT)

Location: `packages/frontend/src/components/workflow/`

**Structure:**
```
workflow/
├── WorkflowBuilder.tsx      # Main builder with ReactFlow canvas
├── WorkflowViewer.tsx       # Read-only viewer for execution
├── ValidationErrors.tsx     # Error display component
├── config.ts                # ReactFlow configuration
├── index.ts                 # Exports all components
├── hooks/
│   └── useWorkflowState.ts  # State management hook
├── toolbar/
│   ├── WorkflowToolbar.tsx  # Save/Execute/Clear buttons
│   └── NodePalette.tsx      # Drag-and-drop node types
├── panels/
│   ├── NodeConfigPanel.tsx  # Node configuration sidebar
│   ├── AgentConfig.tsx      # Agent node settings
│   ├── HumanGateConfig.tsx  # Human gate settings
│   └── CodeReviewConfig.tsx # Code review settings
└── nodes/
    ├── BaseNode.tsx         # Shared node styling
    ├── AgentNode.tsx        # AI agent step node
    ├── HumanGateNode.tsx    # Human review gate node
    └── CodeReviewNode.tsx   # Code review step node
```

**Features implemented:**
- Drag-and-drop node palette (Agent, Human Gate, Code Review)
- ReactFlow canvas with zoom, pan, minimap
- Node connection/edge management
- Node configuration panels for each type
- Workflow name editing
- Validation before execution
- Save/Execute/Clear toolbar buttons

### WorkflowBuilder Props Interface

```typescript
interface WorkflowBuilderProps {
  initialWorkflow?: Workflow;
  onSave: (workflow: Workflow) => Promise<void>;
  onExecute: (workflow: Workflow) => Promise<void>;
}
```

### App.tsx View State (MISSING)

Current `App.tsx` has these view states:
- `selectedMissionId` → Shows MissionDetail
- `showVoiceChat` → Shows ChatVoice
- Default → Welcome message

**Missing:** `showWorkflowBuilder` state to toggle the builder view.

### Navigation (MISSING)

The Sidebar (`packages/frontend/src/components/Sidebar.tsx`) has:
- "New Mission" button → Opens NewMissionModal

**Missing:** "Create Workflow" or "Workflow Editor" button.

### Backend Workflow API

**Existing endpoints:**
- `GET /api/workflows` - Returns hardcoded workflow list

**Missing endpoints:**
- `POST /api/workflows` - Create/save custom workflow
- `PUT /api/workflows/:id` - Update workflow
- `DELETE /api/workflows/:id` - Delete workflow

**Backend source (`packages/backend/src/services/workflow.ts`):**
```typescript
const WORKFLOWS: Record<string, Workflow> = {
  'raw-research-plan-implement': { /* 8 steps */ },
  'oneshot': { /* 2 steps */ },
};
```

### Frontend Workflow API (PLACEHOLDER)

`packages/frontend/src/api/workflowApi.ts`:
```typescript
export async function saveWorkflow(workflow: Workflow): Promise<void> {
  // For now, workflows are not persisted - they're executed directly
  console.log('Workflow save not yet implemented', workflow);
}
```

### Integration Test Evidence

Tests at `packages/backend/tests/integration/routes/workflows.test.ts` show planned API:
- `POST /api/workflows/execute` - Execute a workflow (exists in tests)
- `GET /api/workflows/templates` - Get templates (exists in tests)

## Code References

- `packages/frontend/src/components/workflow/WorkflowBuilder.tsx` - Main component
- `packages/frontend/src/components/workflow/index.ts:1` - Exports (unused)
- `packages/frontend/src/App.tsx:29-360` - App content (missing WorkflowBuilder)
- `packages/frontend/src/components/Sidebar.tsx:93-104` - New Mission button (missing workflow button)
- `packages/backend/src/services/workflow.ts:4-27` - Hardcoded workflows
- `packages/frontend/src/api/workflowApi.ts:8-12` - Placeholder save function
- `packages/frontend/src/types/workflow.ts` - Type definitions

## Architecture Insights

1. **Frontend architecture**: Single-page app without router, uses state-based view switching
2. **Pattern for new views**: Add state variable + conditional render in main content area
3. **Existing pattern**: Voice chat toggle uses `showVoiceChat` boolean state
4. **Workflow data flow**: `useWorkflowState` hook → `toWorkflow()` → `onSave` callback

## What's Needed to Wire Up

### Minimal (Session-only, no persistence):

1. **Add state** in `App.tsx`:
   ```typescript
   const [showWorkflowBuilder, setShowWorkflowBuilder] = useState(false)
   ```

2. **Add button** in Sidebar or header:
   ```tsx
   <Button onClick={() => setShowWorkflowBuilder(true)}>
     <Workflow className="mr-2 h-4 w-4" />
     Create Workflow
   </Button>
   ```

3. **Add conditional render** in main content:
   ```tsx
   {showWorkflowBuilder ? (
     <WorkflowBuilder
       onSave={async (wf) => console.log('Save:', wf)}
       onExecute={async (wf) => { /* create mission with inline workflow */ }}
     />
   ) : showVoiceChat ? (
     // ... existing
   )}
   ```

### Full (With persistence):

1. All of the above
2. **Backend**: Add `POST /api/workflows` endpoint to save to `~/.haflow/workflows/`
3. **Backend**: Add workflow storage service (similar to mission-store)
4. **Frontend**: Implement `saveWorkflow` in API client
5. **Frontend**: Add workflow list view/management

## Open Questions

1. Should workflows be stored per-user or globally in `~/.haflow/workflows/`?
2. Should inline workflows (created in builder, not saved) be supported for one-off missions?
3. Is execute-from-builder meant to create a new mission with that workflow?
4. Should saved workflows appear in the NewMissionModal dropdown?
