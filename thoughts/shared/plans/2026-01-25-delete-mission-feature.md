# Delete Mission Feature Implementation Plan

## Overview

Implement a delete mission feature that allows users to permanently remove missions via the API, with a trash can icon in the sidebar and confirmation dialog. The deletion removes all artifacts, runs, logs, and the mission directory.

## Current State Analysis

- **Backend**: No delete functionality exists. Mission store has create/read/update but no delete.
- **Frontend**: Sidebar shows missions but has no action buttons. No delete UI exists.
- **API**: Six endpoints exist; DELETE is missing.

### Key Discoveries:
- Mission storage is file-based at `~/.haflow/missions/m-<uuid>/` with subdirectories for artifacts, runs, logs
- Pattern for routes established in `missions.ts:103-118` (mark-completed endpoint)
- Pattern for mutations established in `App.tsx:50-101`
- Dialog component available at `components/ui/dialog.tsx`
- Destructive button variant available at `components/ui/button.tsx`

## Desired End State

1. Users can delete missions via a trash icon in the sidebar
2. Deletion requires confirmation via a dialog
3. Deleted missions are permanently removed (all files deleted)
4. If the deleted mission was selected, selection is cleared
5. Mission list refreshes after deletion

### Verification:
- Create a mission → see it in sidebar → delete it → confirm it's gone from sidebar and filesystem

## What We're NOT Doing

- Soft delete or undo functionality
- Docker container cleanup for running missions
- Preventing deletion of running missions (could add later)
- Bulk delete

## Implementation Approach

Two phases: Backend first (route + store), then Frontend (API client, mutation, dialog, sidebar UI).

---

## Phase 1: Backend

### Overview
Add `deleteMission()` to the mission store and expose via `DELETE /api/missions/:missionId`.

### Changes Required:

#### 1. Mission Store - Add delete method
**File**: `packages/backend/src/services/mission-store.ts`

**Change 1**: Add `rm` to fs imports (line 1):
```typescript
import { mkdir, readdir, readFile, writeFile, cp, rm } from 'fs/promises';
```

**Change 2**: Add `deleteMission` function after `updateMeta` (around line 145):
```typescript
// --- Delete ---
async function deleteMission(missionId: string): Promise<void> {
  const meta = await getMeta(missionId);
  if (!meta) throw new Error(`Mission not found: ${missionId}`);
  await rm(missionDir(missionId), { recursive: true, force: true });
}
```

**Change 3**: Export `deleteMission` in the missionStore object (line 252):
```typescript
export const missionStore = {
  init,
  createMission,
  getMeta,
  getDetail,
  listMissions,
  updateMeta,
  deleteMission,  // Add this line
  loadArtifacts,
  // ... rest unchanged
};
```

#### 2. Missions Route - Add DELETE endpoint
**File**: `packages/backend/src/routes/missions.ts`

**Change**: Add DELETE route after the mark-completed route (after line 118):
```typescript
// DELETE /api/missions/:missionId - Delete mission
missionRoutes.delete('/:missionId', async (req, res, next) => {
  try {
    const { missionId } = req.params;

    const meta = await missionStore.getMeta(missionId);
    if (!meta) {
      return sendError(res, `Mission not found: ${missionId}`, 404);
    }

    await missionStore.deleteMission(missionId);
    sendSuccess(res, null);
  } catch (err) {
    next(err);
  }
});
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @haflow/backend build`
- [x] Backend tests pass: `pnpm --filter @haflow/backend test`

#### Manual Verification:
- [ ] Start backend: `pnpm --filter @haflow/backend dev`
- [ ] Create a mission, note its ID
- [ ] Call `curl -X DELETE http://localhost:4000/api/missions/{id}` → returns `{"success":true,"data":null,"error":null}`
- [ ] Verify mission directory is gone from `~/.haflow/missions/`
- [ ] Call DELETE again → returns 404

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Frontend

### Overview
Add delete functionality to the UI: API client method, mutation hook, confirmation dialog, and trash icon in sidebar.

### Changes Required:

#### 1. API Client - Add deleteMission method
**File**: `packages/frontend/src/api/client.ts`

**Change**: Add after `markCompleted` method (after line 61):
```typescript
deleteMission: async (missionId: string): Promise<void> => {
  const res = await client.delete<ApiResponse<void>>(`/missions/${missionId}`);
  if (!res.data.success) throw new Error(res.data.error || 'Failed to delete mission');
},
```

#### 2. Delete Confirmation Dialog Component
**File**: `packages/frontend/src/components/DeleteMissionDialog.tsx` (new file)

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface DeleteMissionDialogProps {
  isOpen: boolean
  missionTitle: string
  onClose: () => void
  onConfirm: () => void
  isDeleting: boolean
}

export function DeleteMissionDialog({
  isOpen,
  missionTitle,
  onClose,
  onConfirm,
  isDeleting,
}: DeleteMissionDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="delete-mission-dialog">
        <DialogHeader>
          <DialogTitle>Delete Mission</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{missionTitle}"? This action cannot be undone.
            All artifacts, runs, and logs will be permanently removed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
            data-testid="delete-cancel-button"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
            data-testid="delete-confirm-button"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

#### 3. App.tsx - Add delete mutation and state
**File**: `packages/frontend/src/App.tsx`

**Change 1**: Add state for delete dialog (after line 26):
```typescript
const [deleteMissionTarget, setDeleteMissionTarget] = useState<{ id: string; title: string } | null>(null)
```

**Change 2**: Add import for DeleteMissionDialog (after line 6):
```typescript
import { DeleteMissionDialog } from '@/components/DeleteMissionDialog'
```

**Change 3**: Add delete mutation (after markCompletedMutation, around line 101):
```typescript
// Mutation: Delete mission
const deleteMissionMutation = useMutation({
  mutationFn: async (missionId: string) => {
    return api.deleteMission(missionId)
  },
  onSuccess: (_, deletedMissionId) => {
    queryClient.invalidateQueries({ queryKey: ['missions'] })
    // Clear selection if deleted mission was selected
    if (selectedMissionId === deletedMissionId) {
      setSelectedMissionId(null)
    }
    setDeleteMissionTarget(null)
  },
})
```

**Change 4**: Add delete handler (after handleMarkCompleted):
```typescript
const handleDeleteMission = (missionId: string, missionTitle: string) => {
  setDeleteMissionTarget({ id: missionId, title: missionTitle })
}

const handleConfirmDelete = async () => {
  if (deleteMissionTarget) {
    await deleteMissionMutation.mutateAsync(deleteMissionTarget.id)
  }
}
```

**Change 5**: Pass handler to Sidebar (update Sidebar props around line 170):
```typescript
<Sidebar
  missions={missions}
  selectedMissionId={selectedMissionId}
  onSelectMission={handleSelectMission}
  onNewMission={handleNewMission}
  onDeleteMission={handleDeleteMission}
  isOpen={isSidebarOpen}
  onClose={() => setIsSidebarOpen(false)}
/>
```

**Change 6**: Add DeleteMissionDialog before closing `</div>` of AppContent (after NewMissionModal):
```typescript
<DeleteMissionDialog
  isOpen={!!deleteMissionTarget}
  missionTitle={deleteMissionTarget?.title ?? ''}
  onClose={() => setDeleteMissionTarget(null)}
  onConfirm={handleConfirmDelete}
  isDeleting={deleteMissionMutation.isPending}
/>
```

#### 4. Sidebar - Add trash icon button
**File**: `packages/frontend/src/components/Sidebar.tsx`

**Change 1**: Update Lucide imports (line 2):
```typescript
import { Plus, X, Trash2 } from 'lucide-react'
```

**Change 2**: Update SidebarProps interface (add after line 14):
```typescript
onDeleteMission: (missionId: string, missionTitle: string) => void
```

**Change 3**: Update function signature to include new prop:
```typescript
export function Sidebar({ missions, selectedMissionId, onSelectMission, onNewMission, onDeleteMission, isOpen, onClose }: SidebarProps) {
```

**Change 4**: Add trash button inside mission item. Update the button element to be a div container (lines 111-137). Replace the entire mission item structure:
```tsx
{missions.map((mission) => (
  <div
    key={mission.mission_id}
    data-testid={`mission-item-${mission.mission_id}`}
    className={cn(
      'w-full text-left p-3 rounded-md transition-colors group relative',
      selectedMissionId === mission.mission_id
        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
        : 'hover:bg-sidebar-accent/50'
    )}
  >
    <button
      onClick={() => onSelectMission(mission.mission_id)}
      className="w-full text-left"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium truncate pr-2">
          {mission.title}
        </span>
        <StatusBadge status={mission.status} testId={`mission-status-${mission.mission_id}`} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground capitalize">
          {mission.type}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatTimeAgo(mission.updated_at)}
        </span>
      </div>
    </button>
    <Button
      variant="ghost"
      size="icon"
      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
      onClick={(e) => {
        e.stopPropagation()
        onDeleteMission(mission.mission_id, mission.title)
      }}
      data-testid={`delete-mission-${mission.mission_id}`}
      aria-label={`Delete ${mission.title}`}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  </div>
))}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter frontend build`
- [ ] Linting passes: `pnpm --filter frontend lint`

#### Manual Verification:
- [ ] Start both backend and frontend
- [ ] Hover over a mission in sidebar → trash icon appears
- [ ] Click trash icon → confirmation dialog opens with mission title
- [ ] Click Cancel → dialog closes, mission remains
- [ ] Click Delete → dialog shows "Deleting...", then closes
- [ ] Mission disappears from sidebar
- [ ] If deleted mission was selected, main area shows "Select a mission..."
- [ ] Mission is gone from filesystem (`~/.haflow/missions/`)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:
- Backend: Test `deleteMission` throws for non-existent mission
- Backend: Test `deleteMission` removes directory

### Integration Tests:
- Backend: Test DELETE route returns 200 for existing mission
- Backend: Test DELETE route returns 404 for non-existent mission

### Manual Testing Steps:
1. Create a new mission
2. Verify mission appears in sidebar
3. Hover over mission → trash icon visible
4. Click trash → confirmation dialog appears
5. Cancel → nothing happens
6. Click trash again → click Delete
7. Mission removed from sidebar
8. Check filesystem - directory gone

## References

- Research document: `thoughts/shared/research/2026-01-25-delete-mission-feature.md`
- Route pattern: `packages/backend/src/routes/missions.ts:103-118`
- Mutation pattern: `packages/frontend/src/App.tsx:50-101`
- Modal pattern: `packages/frontend/src/components/NewMissionModal.tsx`
