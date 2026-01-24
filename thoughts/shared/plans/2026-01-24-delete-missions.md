# Delete Missions Feature Implementation Plan

## Overview

Add the ability to delete missions including all their artifacts, runs, and logs. Deletion will stop any running containers first, require user confirmation, and be accessible from both the Sidebar and MissionDetail views.

## Current State Analysis

### Backend
- `packages/backend/src/services/mission-store.ts` - File-based persistence in `~/.haflow/missions/m-<uuid>/`
- Has CRUD operations but no delete function
- `packages/backend/src/routes/missions.ts` - 6 REST endpoints, no DELETE route
- `packages/backend/src/services/docker.ts` - Has `stop()` and `remove()` methods for containers

### Frontend
- `packages/frontend/src/api/client.ts` - API client, no delete method
- `packages/frontend/src/App.tsx` - TanStack Query mutations pattern
- `packages/frontend/src/components/Sidebar.tsx` - Mission list display
- `packages/frontend/src/components/MissionDetail.tsx` - Mission detail with action buttons
- `packages/frontend/src/components/ui/dialog.tsx` - Radix Dialog for confirmations

### Key Discoveries
- Mission directories contain: `mission.json`, `artifacts/`, `runs/`, `logs/`
- Running missions have containers with `haflow.mission_id` label
- TanStack Query pattern: `useMutation` → `onSuccess: invalidateQueries`
- Tests use temp directories and no mocking for filesystem operations

## Desired End State

After implementation:
1. DELETE `/api/missions/:missionId` endpoint exists and works
2. Running containers are stopped before deletion
3. Delete button appears in both Sidebar (trash icon) and MissionDetail
4. Confirmation dialog prevents accidental deletion
5. After deletion, UI navigates away from deleted mission
6. Unit and integration tests cover the new functionality

## What We're NOT Doing

- Soft delete / archiving (this is a hard delete)
- Batch deletion of multiple missions
- Undo functionality
- Deletion of individual artifacts (only full mission deletion)

## Implementation Approach

Backend-first approach: add the delete function and route, then add frontend UI and tests.

---

## Phase 1: Backend - Delete Function and Route

### Overview
Add `deleteMission` to mission-store.ts and DELETE route to missions.ts.

### Changes Required:

#### 1. Mission Store
**File**: `packages/backend/src/services/mission-store.ts`
**Changes**: Add `rm` import and `deleteMission` function

```typescript
// Line 1: Add rm to imports
import { mkdir, readdir, readFile, writeFile, rm } from 'fs/promises';

// After updateMeta function (around line 122), add:
// --- Delete ---
async function deleteMission(missionId: string): Promise<void> {
  const dir = missionDir(missionId);
  if (!existsSync(dir)) {
    throw new Error(`Mission not found: ${missionId}`);
  }
  await rm(dir, { recursive: true, force: true });
}

// Add to exports object (around line 228):
deleteMission,
```

#### 2. Mission Routes
**File**: `packages/backend/src/routes/missions.ts`
**Changes**: Add DELETE route that stops containers and deletes mission

```typescript
// Add import for dockerProvider at top
import { dockerProvider } from '../services/docker.js';

// Add after mark-completed route (end of file):
// DELETE /api/missions/:missionId - Delete mission
missionRoutes.delete('/:missionId', async (req, res, next) => {
  try {
    const { missionId } = req.params;

    const meta = await missionStore.getMeta(missionId);
    if (!meta) {
      return sendError(res, `Mission not found: ${missionId}`, 404);
    }

    // Stop any running containers for this mission
    if (meta.status === 'running') {
      try {
        await dockerProvider.stop(missionId);
        await dockerProvider.remove(missionId);
      } catch {
        // Container may already be stopped/removed, continue with deletion
      }
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
- [ ] TypeScript compiles: `pnpm --filter @haflow/backend build`
- [ ] Existing tests pass: `pnpm --filter @haflow/backend test`

#### Manual Verification:
- [ ] Can call DELETE endpoint via curl: `curl -X DELETE http://localhost:4000/api/missions/m-xxx`
- [ ] Mission directory is removed from `~/.haflow/missions/`

**Implementation Note**: Pause here for manual verification before proceeding.

---

## Phase 2: Backend Tests

### Overview
Add unit tests for deleteMission and integration tests for DELETE route.

### Changes Required:

#### 1. Unit Tests
**File**: `packages/backend/tests/unit/services/mission-store.test.ts`
**Changes**: Add test group for deleteMission

```typescript
// Add after updateMeta tests (around line 229):
describe('deleteMission', () => {
  it('should delete mission directory and all contents', async () => {
    const store = await getMissionStore();
    const mission = await store.createMission('Test', 'standard-feature', 'input');

    // Verify mission exists
    const metaBefore = await store.getMeta(mission.mission_id);
    expect(metaBefore).not.toBeNull();

    // Delete mission
    await store.deleteMission(mission.mission_id);

    // Verify mission is gone
    const metaAfter = await store.getMeta(mission.mission_id);
    expect(metaAfter).toBeNull();

    // Verify directory is removed
    const missionDir = join(getTestDir(), 'missions', mission.mission_id);
    expect(existsSync(missionDir)).toBe(false);
  });

  it('should throw error for non-existent mission', async () => {
    const store = await getMissionStore();
    await expect(store.deleteMission('m-nonexistent')).rejects.toThrow('Mission not found');
  });
});
```

#### 2. Integration Tests
**File**: `packages/backend/tests/integration/routes/missions.test.ts`
**Changes**: Add test group for DELETE route

```typescript
// Add at end of file:
describe('DELETE /api/missions/:missionId', () => {
  it('should return 404 for non-existent mission', async () => {
    const response = await request(BASE_URL)
      .delete('/api/missions/m-nonexistent')
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('not found');
  });

  it('should delete mission and return success', async () => {
    const missionId = await createTestMission();

    // Verify it exists
    await request(BASE_URL)
      .get(`/api/missions/${missionId}`)
      .expect(200);

    // Delete it
    const deleteResponse = await request(BASE_URL)
      .delete(`/api/missions/${missionId}`)
      .expect(200);

    expect(deleteResponse.body.success).toBe(true);

    // Verify it's gone
    await request(BASE_URL)
      .get(`/api/missions/${missionId}`)
      .expect(404);
  });

  it('should remove mission from list after deletion', async () => {
    const missionId = await createTestMission();

    // Delete it
    await request(BASE_URL)
      .delete(`/api/missions/${missionId}`)
      .expect(200);

    // Check list doesn't include it
    const listResponse = await request(BASE_URL)
      .get('/api/missions')
      .expect(200);

    const missionIds = listResponse.body.data.map((m: any) => m.mission_id);
    expect(missionIds).not.toContain(missionId);
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] All tests pass: `pnpm --filter @haflow/backend test`
- [ ] New tests specifically pass: `pnpm --filter @haflow/backend vitest run tests/unit/services/mission-store.test.ts`

#### Manual Verification:
- [ ] N/A - automated tests cover functionality

---

## Phase 3: Frontend - API Client and Mutation

### Overview
Add deleteMission method to API client and create mutation in App.tsx.

### Changes Required:

#### 1. API Client
**File**: `packages/frontend/src/api/client.ts`
**Changes**: Add deleteMission method

```typescript
// Add after markCompleted (around line 52):
deleteMission: async (missionId: string): Promise<void> => {
  const res = await client.delete<ApiResponse<void>>(`/missions/${missionId}`);
  if (!res.data.success) throw new Error(res.data.error || 'Failed to delete mission');
},
```

#### 2. App.tsx Mutation
**File**: `packages/frontend/src/App.tsx`
**Changes**: Add delete mutation and handler

```typescript
// Add after markCompletedMutation (around line 99):
const deleteMissionMutation = useMutation({
  mutationFn: async (missionId: string) => {
    return api.deleteMission(missionId);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['missions'] });
    // Clear selection if deleted mission was selected
    setSelectedMissionId(null);
  },
});

// Add handler function (around line 130):
const handleDeleteMission = async (missionId: string) => {
  await deleteMissionMutation.mutateAsync(missionId);
};
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter frontend build`
- [ ] Lint passes: `pnpm --filter frontend lint`

#### Manual Verification:
- [ ] Can call `api.deleteMission('m-xxx')` from browser console

---

## Phase 4: Frontend - Confirmation Dialog Component

### Overview
Create a reusable ConfirmDialog component for delete confirmations.

### Changes Required:

#### 1. ConfirmDialog Component
**File**: `packages/frontend/src/components/ConfirmDialog.tsx` (new file)
**Changes**: Create confirmation dialog component

```typescript
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Deleting...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter frontend build`

#### Manual Verification:
- [ ] Component renders correctly when imported

---

## Phase 5: Frontend - Delete Button in MissionDetail

### Overview
Add delete button to MissionDetail component with confirmation.

### Changes Required:

#### 1. MissionDetail Component
**File**: `packages/frontend/src/components/MissionDetail.tsx`
**Changes**: Add delete button and confirmation dialog

```typescript
// Add import at top:
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

// Update interface (around line 13):
interface MissionDetailProps {
  mission: MissionDetail;
  onSaveArtifact: (filename: string, content: string) => Promise<void>;
  onContinue: () => void;
  onMarkCompleted: () => void;
  onDelete: () => void;        // Add this
  isDeleting?: boolean;         // Add this
}

// Update component signature:
export function MissionDetail({
  mission,
  onSaveArtifact,
  onContinue,
  onMarkCompleted,
  onDelete,
  isDeleting = false,
}: MissionDetailProps)

// Add state inside component:
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

// Add delete button in action buttons area (near line 345-350):
<Button
  variant="outline"
  onClick={() => setShowDeleteConfirm(true)}
  className="text-destructive hover:text-destructive"
>
  <Trash2 className="h-4 w-4 mr-2" />
  Delete
</Button>

// Add ConfirmDialog at end of component, before closing fragment:
<ConfirmDialog
  open={showDeleteConfirm}
  onOpenChange={setShowDeleteConfirm}
  title="Delete Mission"
  description={`Are you sure you want to delete "${mission.title}"? This will permanently remove all artifacts, runs, and logs.`}
  confirmLabel="Delete"
  onConfirm={() => {
    onDelete();
    setShowDeleteConfirm(false);
  }}
  isLoading={isDeleting}
/>
```

#### 2. App.tsx - Pass Delete Props
**File**: `packages/frontend/src/App.tsx`
**Changes**: Pass onDelete and isDeleting to MissionDetail

```typescript
// Update MissionDetail props (around line 202):
<MissionDetail
  mission={selectedMission}
  onSaveArtifact={handleSaveArtifact}
  onContinue={handleContinue}
  onMarkCompleted={handleMarkCompleted}
  onDelete={() => handleDeleteMission(selectedMissionId!)}
  isDeleting={deleteMissionMutation.isPending}
/>
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter frontend build`
- [ ] Lint passes: `pnpm --filter frontend lint`

#### Manual Verification:
- [ ] Delete button appears in MissionDetail
- [ ] Clicking delete shows confirmation dialog
- [ ] Confirming deletes mission and navigates away
- [ ] Canceling closes dialog without deleting

---

## Phase 6: Frontend - Delete Button in Sidebar

### Overview
Add trash icon button to each mission in the Sidebar.

### Changes Required:

#### 1. Sidebar Component
**File**: `packages/frontend/src/components/Sidebar.tsx`
**Changes**: Add delete button per mission with confirmation

```typescript
// Add imports:
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

// Update SidebarProps interface:
interface SidebarProps {
  missions: MissionListItem[];
  selectedMissionId: string | null;
  onSelectMission: (id: string) => void;
  onNewMission: () => void;
  onDeleteMission: (id: string) => void;  // Add this
  isDeletingMission?: string | null;       // Add this (mission ID being deleted)
  isOpen: boolean;
  onClose: () => void;
}

// Update component signature:
export function Sidebar({
  missions,
  selectedMissionId,
  onSelectMission,
  onNewMission,
  onDeleteMission,
  isDeletingMission,
  isOpen,
  onClose
}: SidebarProps)

// Add state for confirmation:
const [missionToDelete, setMissionToDelete] = useState<MissionListItem | null>(null);

// In mission map, add delete button (around line 102-120):
{missions.map((mission) => (
  <div
    key={mission.mission_id}
    className={cn(
      'group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors',
      selectedMissionId === mission.mission_id
        ? 'bg-primary/10 border border-primary/20'
        : 'hover:bg-muted'
    )}
    onClick={() => onSelectMission(mission.mission_id)}
  >
    <div className="flex-1 min-w-0">
      <div className="font-medium truncate">{mission.title}</div>
      <StatusBadge status={mission.status} />
    </div>
    <button
      onClick={(e) => {
        e.stopPropagation();
        setMissionToDelete(mission);
      }}
      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-opacity"
      title="Delete mission"
    >
      <Trash2 className="h-4 w-4 text-destructive" />
    </button>
  </div>
))}

// Add ConfirmDialog at end of component:
<ConfirmDialog
  open={missionToDelete !== null}
  onOpenChange={(open) => !open && setMissionToDelete(null)}
  title="Delete Mission"
  description={missionToDelete ? `Are you sure you want to delete "${missionToDelete.title}"? This will permanently remove all artifacts, runs, and logs.` : ''}
  confirmLabel="Delete"
  onConfirm={() => {
    if (missionToDelete) {
      onDeleteMission(missionToDelete.mission_id);
      setMissionToDelete(null);
    }
  }}
  isLoading={isDeletingMission === missionToDelete?.mission_id}
/>
```

#### 2. App.tsx - Pass Delete Props to Sidebar
**File**: `packages/frontend/src/App.tsx`
**Changes**: Pass delete handler to Sidebar

```typescript
// Update Sidebar props (around line 164-170):
<Sidebar
  missions={missions}
  selectedMissionId={selectedMissionId}
  onSelectMission={handleSelectMission}
  onNewMission={() => setIsNewMissionOpen(true)}
  onDeleteMission={handleDeleteMission}
  isDeletingMission={deleteMissionMutation.isPending ? deleteMissionMutation.variables : null}
  isOpen={isSidebarOpen}
  onClose={() => setIsSidebarOpen(false)}
/>
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter frontend build`
- [ ] Lint passes: `pnpm --filter frontend lint`

#### Manual Verification:
- [ ] Trash icon appears on hover over mission in sidebar
- [ ] Clicking trash shows confirmation dialog
- [ ] Confirming deletes mission
- [ ] If deleted mission was selected, selection clears

---

## Testing Strategy

### Unit Tests:
- `deleteMission` removes directory and all contents
- `deleteMission` throws for non-existent mission

### Integration Tests:
- DELETE returns 404 for non-existent mission
- DELETE returns 200 and removes mission
- Deleted mission no longer appears in list

### Manual Testing Steps:
1. Create a mission, run a step, then delete it - verify all files removed
2. Delete a running mission - verify container stops and mission deletes
3. Delete from sidebar while viewing different mission - UI stays on current
4. Delete currently viewed mission - UI navigates to empty state
5. Cancel delete confirmation - mission remains

## Performance Considerations

- `rm -rf` is fast even for large directories
- Stopping containers adds latency for running missions only
- Query invalidation triggers refetch, which is already polled every 2s

## References

- Mission store: `packages/backend/src/services/mission-store.ts`
- Mission routes: `packages/backend/src/routes/missions.ts`
- Frontend API: `packages/frontend/src/api/client.ts`
- Dialog component: `packages/frontend/src/components/ui/dialog.tsx`
- Existing tests: `packages/backend/tests/unit/services/mission-store.test.ts`
