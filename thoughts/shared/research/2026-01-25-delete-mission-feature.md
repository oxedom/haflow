---
date: 2026-01-25T10:53:29+02:00
researcher: Claude
git_commit: 9a80f9f1f035166d29e36a2eae374e07290a337a
branch: main
repository: haflow
topic: "Delete Mission Feature Implementation"
tags: [research, codebase, missions, api, frontend, deletion]
status: complete
last_updated: 2026-01-25
last_updated_by: Claude
---

# Research: Delete Mission Feature Implementation

**Date**: 2026-01-25T10:53:29+02:00
**Researcher**: Claude
**Git Commit**: 9a80f9f1f035166d29e36a2eae374e07290a337a
**Branch**: main
**Repository**: haflow

## Research Question
How to implement a delete mission feature that will delete missions via the API on frontend, with a trash can icon and confirmation dialog on the sidebar of a mission, including deletion of all artifacts.

## Summary

The codebase currently has **no delete functionality** for missions. Implementation requires:

1. **Backend**: Add `DELETE /api/missions/:missionId` route and `deleteMission()` store method
2. **Frontend**: Add trash icon to sidebar mission items, confirmation dialog component, mutation hook, and API client method
3. **Shared**: No changes needed (ApiResponse wrapper already handles void responses)

All patterns for dialogs, destructive actions, and mutations exist in the codebase and can be followed.

## Detailed Findings

### Backend Mission API

**File**: `packages/backend/src/routes/missions.ts`

Current endpoints (no DELETE):
- `GET /api/missions` - List missions (line 21)
- `GET /api/missions/:missionId` - Get detail (line 31)
- `POST /api/missions` - Create mission (line 47)
- `PUT /api/missions/:missionId/artifacts/:filename` - Save artifact (line 63)
- `POST /api/missions/:missionId/continue` - Advance workflow (line 86)
- `POST /api/missions/:missionId/mark-completed` - Force complete (line 103)

**Route pattern to follow** (from `mark-completed` at line 103-118):
```typescript
missionRoutes.delete('/:missionId', async (req, res, next) => {
  try {
    const { missionId } = req.params;
    await missionStore.deleteMission(missionId);
    sendSuccess(res, null);
  } catch (error) {
    next(error);
  }
});
```

### Mission Store Service

**File**: `packages/backend/src/services/mission-store.ts`

Current imports (line 1-2):
```typescript
import { mkdir, readdir, readFile, writeFile, cp } from 'fs/promises';
import { existsSync } from 'fs';
```

**Need to add**: `rm` to imports for recursive directory deletion.

Path helper functions (lines 9-14):
```typescript
const missionDir = (missionId: string) => join(missionsDir(), missionId);
```

**Suggested deleteMission implementation**:
```typescript
async function deleteMission(missionId: string): Promise<void> {
  const meta = await getMeta(missionId);
  if (!meta) throw new Error(`Mission not found: ${missionId}`);
  await rm(missionDir(missionId), { recursive: true, force: true });
}
```

Storage structure to delete:
```
~/.haflow/missions/m-<uuid>/
  mission.json          # MissionMeta
  artifacts/            # raw-input.md, structured-text.md, etc.
  runs/                 # r-<uuid>.json per step execution
  logs/                 # r-<uuid>.log container output
```

### Docker Container Cleanup

**File**: `packages/backend/src/services/docker.ts`

Containers are labeled with mission IDs (lines 40-44):
```typescript
const labels = [
  `--label=${LABEL_PREFIX}.mission_id=${missionId}`,
  ...
];
```

**Cleanup pattern** from `cleanupOrphaned()` (lines 140-155):
```typescript
const { stdout } = await execAsync(
  `docker ps -aq --filter="label=${LABEL_PREFIX}.mission_id"`
);
```

Consider stopping/removing containers for the mission before deleting files.

### Frontend Sidebar Component

**File**: `packages/frontend/src/components/Sidebar.tsx`

Mission list item structure (lines 111-137):
- Button element with click handler for selection
- Top row: title + status badge (lines 122-127)
- Bottom row: type + time ago (lines 128-135)

**No action buttons currently exist** on mission items.

Icons already imported (line 2):
```typescript
import { Plus, X } from 'lucide-react'
```

**Add trash icon** for delete action:
```typescript
import { Plus, X, Trash2 } from 'lucide-react'
```

### Dialog Component

**File**: `packages/frontend/src/components/ui/dialog.tsx`

Radix UI-based dialog with all needed components:
- `Dialog`, `DialogTrigger`, `DialogContent`
- `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`

### Modal Pattern Example

**File**: `packages/frontend/src/components/NewMissionModal.tsx` (lines 94-199)

Key pattern:
```typescript
<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={onClose}>Cancel</Button>
      <Button variant="destructive">Delete</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Button Variants

**File**: `packages/frontend/src/components/ui/button.tsx` (line 14-15)

Destructive variant available:
```typescript
destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
```

Icon button size:
```typescript
icon: 'h-9 w-9',
```

### TanStack Query Mutation Pattern

**File**: `packages/frontend/src/App.tsx` (lines 50-101)

```typescript
const deleteMissionMutation = useMutation({
  mutationFn: async (missionId: string) => {
    return api.deleteMission(missionId);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['missions'] });
    // Clear selection if deleted mission was selected
    if (selectedMissionId === deletedId) {
      setSelectedMissionId(null);
    }
  },
});
```

### API Client Structure

**File**: `packages/frontend/src/api/client.ts`

Pattern for DELETE request:
```typescript
deleteMission: async (missionId: string): Promise<void> => {
  const res = await client.delete<ApiResponse<void>>(`/missions/${missionId}`);
  if (!res.data.success) throw new Error(res.data.error || 'Failed to delete mission');
},
```

### Shared Types

**File**: `packages/shared/src/schemas.ts`

ApiResponse wrapper (lines 63-68):
```typescript
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.nullable(),
    error: z.string().nullable(),
  });
```

No new types needed - DELETE returns `ApiResponse<void>`.

## Code References

### Backend
- `packages/backend/src/routes/missions.ts:103-118` - Route pattern (mark-completed)
- `packages/backend/src/services/mission-store.ts:1-2` - FS imports (add `rm`)
- `packages/backend/src/services/mission-store.ts:9-14` - Path helpers
- `packages/backend/src/services/mission-store.ts:81-86` - getMeta pattern
- `packages/backend/src/services/mission-store.ts:252-267` - Exported methods
- `packages/backend/src/services/docker.ts:140-155` - Container cleanup pattern
- `packages/backend/src/utils/config.ts:9-17` - Mission storage path

### Frontend
- `packages/frontend/src/components/Sidebar.tsx:111-137` - Mission list items
- `packages/frontend/src/components/Sidebar.tsx:122-127` - Top row (add delete icon here)
- `packages/frontend/src/components/ui/dialog.tsx` - Dialog component
- `packages/frontend/src/components/ui/button.tsx:14-15` - Destructive variant
- `packages/frontend/src/components/NewMissionModal.tsx:94-199` - Modal pattern
- `packages/frontend/src/App.tsx:50-101` - Mutation patterns
- `packages/frontend/src/api/client.ts:58-61` - API method pattern

### Shared
- `packages/shared/src/schemas.ts:63-68` - ApiResponse wrapper

## Architecture Insights

1. **File-based storage**: Missions stored as directories under `~/.haflow/missions/m-<uuid>/`. Delete can use `rm -rf` equivalent (`rm` with `recursive: true`).

2. **No soft delete**: Pattern suggests hard delete (remove files). No "deleted" status exists.

3. **Container cleanup**: Consider stopping containers labeled with the mission ID before deleting files, though containers may already be stopped.

4. **Query invalidation**: After delete, invalidate `['missions']` query to refresh sidebar.

5. **Selection state**: If deleted mission was selected, clear `selectedMissionId` in App.tsx.

## Implementation Checklist

### Backend
- [ ] Add `rm` to imports in `mission-store.ts`
- [ ] Add `deleteMission()` method to mission store
- [ ] Export `deleteMission` in missionStore object
- [ ] Add `DELETE /api/missions/:missionId` route
- [ ] (Optional) Add container cleanup for mission before file deletion

### Frontend
- [ ] Add `deleteMission` method to API client
- [ ] Create `DeleteMissionDialog` component with confirmation
- [ ] Add `deleteMissionMutation` to App.tsx
- [ ] Add `onDeleteMission` handler to App.tsx
- [ ] Pass `onDeleteMission` prop to Sidebar
- [ ] Add trash icon button to mission list items in Sidebar
- [ ] Handle selection clearing when deleted mission was selected

### Testing
- [ ] Add unit test for `deleteMission` in mission-store.test.ts
- [ ] Test delete route returns 404 for non-existent mission
- [ ] Test successful deletion removes directory

## Open Questions

1. Should we stop running containers for a mission before deleting?
2. Should there be a confirmation dialog, or just allow undo? (User specified confirmation dialog)
3. Should we prevent deleting missions that are currently running?

## Related Research

None found in `thoughts/shared/research/`.
