# Audio Notification Trigger Points

This document identifies where audio notifications should be triggered in the haflow workflow system.

## Identified Trigger Points

### 1. Mission Moves to Waiting Human State
**Location**: `packages/backend/src/services/mission-engine.ts:62-63`
**Event**: Mission status changes to `waiting_human` after an agent step completes
**Method**: `advanceToNextStep()` when next step is type `human-gate`
**Data Available**:
- `missionId`: The mission ID
- `meta.current_step`: Current step index
- Next step type and name

**Notification Details**:
- Priority: `high` (human review required)
- Action: Notify humans that a mission requires review

### 2. Mission Moves to Waiting Code Review State
**Location**: `packages/backend/src/services/mission-engine.ts:64-65`
**Event**: Mission status changes to `waiting_code_review` after agent step completes
**Method**: `advanceToNextStep()` when next step is type `code-review`
**Data Available**:
- `missionId`: The mission ID
- `meta.current_step`: Current step index
- Next step type and name

**Notification Details**:
- Priority: `standard` (code review needed)
- Action: Notify humans that a mission has code changes requiring review

### 3. Mission Created
**Location**: `packages/backend/src/services/mission-store.ts:36-78`
**Event**: New mission is created
**Method**: `createMission()` determines initial status
**Data Available**:
- `missionId`: The mission ID
- `title`: Mission title
- `type`: Mission type (feature, fix, bugfix, hotfix, enhance)
- `first_step`: First step in workflow

**Notification Details**:
- Priority: `low` (informational)
- Action: Notify that a new mission has been created

## Notification Handler Integration Points

### Potential Integration Locations

1. **In `advanceToNextStep()` after status change**
   - Emit event when entering `waiting_human` or `waiting_code_review` states
   - Include step information and mission details

2. **In `startAgentStep()` completion**
   - Emit event when agent step completes
   - Include completion details

3. **Custom Event Emitter Pattern**
   - Create an event emitter that publishes workflow events
   - Audio notification system subscribes to specific events

## Workflow Status Transitions

```
draft
  ↓
[human-gate] → waiting_human (TRIGGER: Audio notification for high priority)
  ↓
[agent] → ready
  ↓
[human-gate] → waiting_human (TRIGGER: Audio notification for high priority)
  ↓
[agent] → ready
  ↓
[code-review] → waiting_code_review (TRIGGER: Audio notification for standard priority)
  ↓
completed
```

## Implementation Strategy

### Option 1: Direct Event Emission
Emit audio notification events directly in `mission-engine.ts` when status changes occur.

**Pros**:
- Simple, direct implementation
- Clear trigger point visibility

**Cons**:
- Couples business logic with notification logic
- Hard to test independently

### Option 2: Event Bus Pattern
Create an event bus that publishes workflow events to subscribers.

**Pros**:
- Decoupled architecture
- Easy to test and extend
- Can support multiple subscribers

**Cons**:
- Additional abstraction layer
- Requires event bus implementation

### Option 3: Webhook Pattern
When status changes, make HTTP calls to registered webhook endpoints.

**Pros**:
- Works for distributed systems
- External services can subscribe

**Cons**:
- Network overhead
- Requires webhook endpoint in frontend

## Recommended Approach

**Implement Event Bus Pattern** with the following structure:

1. Create `src/services/event-bus.ts` in backend
2. Emit `mission:waiting_human` and `mission:waiting_code_review` events
3. Backend maintains a simple in-memory listener for audio notifications
4. Frontend can subscribe via WebSocket or polling for real-time notifications

## Example Event Structure

```typescript
interface WorkflowEvent {
  type: 'mission:waiting_human' | 'mission:waiting_code_review' | 'mission:created';
  missionId: string;
  timestamp: number;
  data: {
    title: string;
    stepName: string;
    stepIndex: number;
    priority: 'high' | 'standard' | 'low';
  };
}
```

## Frontend Integration

The frontend audio notification system should:

1. Connect to the backend API polling endpoint
2. When new notification event arrives, check user preferences
3. If audio enabled for priority level, play the appropriate sound
4. Display visual notification

## Implementation Checklist

- [ ] Event structure defined
- [ ] Event emission points identified and documented
- [ ] Audio notification handler created
- [ ] Frontend polling or WebSocket implementation
- [ ] User preference integration
- [ ] Error handling and fallbacks
- [ ] Tests for event emission and handling
