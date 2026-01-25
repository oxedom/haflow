---
name: Delete Mission Enhancement
overview: Add delete functionality for individual missions (with container cleanup) and a "Delete All Missions" button that wipes ~/.haflow/missions/*.
todos:
  - id: backend-docker
    content: Add removeByMissionId() to docker.ts
    status: completed
  - id: backend-store
    content: Add deleteAllMissions() to mission-store.ts
    status: completed
  - id: backend-routes
    content: Update DELETE endpoint and add DELETE /api/missions
    status: completed
  - id: frontend-api
    content: Add deleteMission and deleteAllMissions to API client
    status: completed
  - id: frontend-detail
    content: Add delete button with confirmation to MissionDetail
    status: completed
  - id: frontend-app
    content: Add mutations and Delete All Missions button to App.tsx
    status: completed
---

# Delete Mission Enhancement

## Overview

Add two delete features: (a) delete individual missions with their associated Docker containers, and (b) delete all missions to reset ~/.haflow/missions/*.

## Implementation

### Phase 1: Backend - Enhanced Delete Endpoints

**File**: [`packages/backend/src/services/docker.ts`](packages/backend/src/services/docker.ts)

- Add `removeByMissionId(missionId: string)` function to find and remove containers with label `haflow.mission_id={missionId}`

**File**: [`packages/backend/src/routes/missions.ts`](packages/backend/src/routes/missions.ts)

- Modify `DELETE /api/missions/:missionId` to also cleanup associated containers before deleting mission directory
- Add `DELETE /api/missions` endpoint to delete ALL missions (wipes ~/.haflow/missions/*)

**File**: [`packages/backend/src/services/mission-store.ts`](packages/backend/src/services/mission-store.ts)

- Add `deleteAllMissions()` function that removes everything in missions directory

### Phase 2: Frontend - API Client

**File**: [`packages/frontend/src/api/client.ts`](packages/frontend/src/api/client.ts)

- Add `deleteMission(missionId: string)` method
- Add `deleteAllMissions()` method

### Phase 3: Frontend - Delete Mission Button

**File**: [`packages/frontend/src/components/MissionDetail.tsx`](packages/frontend/src/components/MissionDetail.tsx)

- Add delete button in the header area (near mission title/status)
- Add confirmation dialog before deletion
- Pass `onDelete` callback prop

**File**: [`packages/frontend/src/App.tsx`](packages/frontend/src/App.tsx)

- Add `deleteMissionMutation` using TanStack Query
- Handle `onDelete` - clear selection after successful delete
- Add `deleteAllMissionsMutation`
- Add "Delete All Missions" button near existing "Cleanup Containers" button with confirmation dialog

## Key Code Changes

### Docker - Find containers by mission:

```typescript
async function removeByMissionId(missionId: string): Promise<number> {
  const { stdout } = await execAsync(
    `docker ps -aq --filter="label=${LABEL_PREFIX}.mission_id=${missionId}"`
  );
  const ids = stdout.trim().split('\n').filter(Boolean);
  for (const id of ids) await remove(id);
  return ids.length;
}
```

### Delete mission route enhancement:

```typescript
// Delete mission AND its containers
await dockerProvider.removeByMissionId(missionId);
await missionStore.deleteMission(missionId);
```

### Delete all missions:

```typescript
async function deleteAllMissions(): Promise<void> {
  const { rm, readdir } = await import('fs/promises');
  const dir = missionsDir();
  const entries = await readdir(dir);
  for (const entry of entries) {
    await rm(join(dir, entry), { recursive: true, force: true });
  }
}
```