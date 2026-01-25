# Docker Logs Capture Implementation Plan

## Overview

Capture raw Docker container output (stdout and stderr) to separate log files for debugging and auditing. This preserves the untransformed container output that is currently lost during JSON parsing.

## Current State Analysis

**What exists:**
- `ClaudeSandboxOptions` interface already includes `missionId` and `runId` but they're **unused** in `startClaudeStreaming()`
- Logs stored in `~/.haflow/missions/{missionId}/logs/{runId}.log` (formatted/parsed output only)
- Raw stdout is immediately parsed via `readline` + `parseStreamJsonLine()` - non-JSON lines discarded
- Stderr is captured in memory (`stderrOutput` variable) but only used for error messages, never persisted

**Key file references:**
- `packages/backend/src/services/docker.ts:344-377` - spawn and readline processing
- `packages/backend/src/services/docker.ts:349-352` - stderr memory capture
- `packages/backend/src/services/mission-store.ts:224-234` - `appendLog()` function
- `packages/backend/src/services/sandbox.ts:16-24` - `ClaudeSandboxOptions` interface

### Key Discoveries:
- `missionId` and `runId` are in options but only 4 of 7 fields are destructured at `docker.ts:282`
- Codebase uses read-then-write pattern for appending (no streams)
- `logsDir` helper already exists at `mission-store.ts:13`

## Desired End State

After implementation:
1. Every Claude streaming run produces two additional log files:
   - `logs/{runId}-docker-stdout.log` - raw container stdout
   - `logs/{runId}-docker-stderr.log` - raw container stderr
2. Files contain untransformed output (raw JSON lines, startup messages, errors)
3. Capture starts before first container output and ends when process exits

**Verification:**
- Run a mission step, check that `-docker-stdout.log` and `-docker-stderr.log` files exist
- Content should match what Docker Desktop shows for that container

## What We're NOT Doing

- Mock agent mode (polling-based) - only used for tests
- Log rotation or size limits
- Streaming I/O patterns (using existing read-then-write)
- Nested `runs/{runId}/` directory structure (keeping flat `logs/` structure)
- Frontend display of docker logs (separate feature)

## Implementation Approach

Capture raw output at the spawn level in `docker.ts` using existing `missionId`/`runId` from options. Add helper functions to `mission-store.ts` for the new log files.

## Phase 1: Add Docker Log Helpers to mission-store.ts

### Overview
Add functions to append raw Docker output to separate stdout/stderr log files.

### Changes Required:

#### 1. mission-store.ts
**File**: `packages/backend/src/services/mission-store.ts`
**Changes**: Add two new append functions for docker logs

```typescript
async function appendDockerStdout(missionId: string, runId: string, data: string): Promise<void> {
  const dir = logsDir(missionId);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  const path = join(dir, `${runId}-docker-stdout.log`);
  const existing = existsSync(path) ? await readFile(path, 'utf-8') : '';
  await writeFile(path, existing + data);
}

async function appendDockerStderr(missionId: string, runId: string, data: string): Promise<void> {
  const dir = logsDir(missionId);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  const path = join(dir, `${runId}-docker-stderr.log`);
  const existing = existsSync(path) ? await readFile(path, 'utf-8') : '';
  await writeFile(path, existing + data);
}
```

Export both functions in the module exports.

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @haflow/backend build`
- [x] Existing tests pass: `pnpm --filter @haflow/backend test`

#### Manual Verification:
- [x] N/A for this phase (functions not yet called)

---

## Phase 2: Capture Raw Output in docker.ts

### Overview
Modify `startClaudeStreaming` to capture raw stdout/stderr to the new log files.

### Changes Required:

#### 1. docker.ts imports
**File**: `packages/backend/src/services/docker.ts`
**Changes**: Import the new mission-store functions

```typescript
import { appendDockerStdout, appendDockerStderr } from './mission-store.js';
```

#### 2. docker.ts startClaudeStreaming
**File**: `packages/backend/src/services/docker.ts`
**Changes**:
- Destructure `missionId` and `runId` from options (currently unused)
- Add stdout data handler that appends to docker-stdout.log
- Modify stderr data handler to also append to docker-stderr.log

At line ~282, update destructuring:
```typescript
const { artifactsPath, prompt, workspacePath, nodeModulesPath, missionId, runId } = options;
```

After spawn (around line 349), modify stderr handler:
```typescript
let stderrOutput = '';
childProcess.stderr.on('data', (data) => {
  const chunk = data.toString();
  stderrOutput += chunk;
  // Capture to docker stderr log
  appendDockerStderr(missionId, runId, chunk).catch(() => {
    // Ignore write errors to not disrupt streaming
  });
});
```

Add stdout capture handler (before readline setup, around line 354):
```typescript
childProcess.stdout.on('data', (data) => {
  const chunk = data.toString();
  appendDockerStdout(missionId, runId, chunk).catch(() => {
    // Ignore write errors to not disrupt streaming
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @haflow/backend build`
- [x] Existing tests pass: `pnpm --filter @haflow/backend test`

#### Manual Verification:
- [ ] Run a mission step via the UI
- [ ] Check `~/.haflow/missions/{missionId}/logs/` for `-docker-stdout.log` and `-docker-stderr.log` files
- [ ] Verify stdout log contains raw JSON lines from Claude
- [ ] Verify stderr log exists (may be empty if no errors)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Add Tests

### Overview
Add unit tests for the new mission-store functions.

### Changes Required:

#### 1. mission-store.test.ts
**File**: `packages/backend/tests/unit/services/mission-store.test.ts`
**Changes**: Add tests for `appendDockerStdout` and `appendDockerStderr`

```typescript
describe('appendDockerStdout', () => {
  it('should create docker stdout log file', async () => {
    const created = await missionStore.createMission({ title: 'Test', type: 'feature', raw_input: 'test' });
    const run = await missionStore.createRun(created.mission_id, 'cleanup');

    await missionStore.appendDockerStdout(created.mission_id, run.run_id, 'raw stdout line 1\n');

    const logPath = join(testDir, 'missions', created.mission_id, 'logs', `${run.run_id}-docker-stdout.log`);
    expect(existsSync(logPath)).toBe(true);
    const content = await readFile(logPath, 'utf-8');
    expect(content).toBe('raw stdout line 1\n');
  });

  it('should append to existing docker stdout log', async () => {
    const created = await missionStore.createMission({ title: 'Test', type: 'feature', raw_input: 'test' });
    const run = await missionStore.createRun(created.mission_id, 'cleanup');

    await missionStore.appendDockerStdout(created.mission_id, run.run_id, 'line 1\n');
    await missionStore.appendDockerStdout(created.mission_id, run.run_id, 'line 2\n');

    const logPath = join(testDir, 'missions', created.mission_id, 'logs', `${run.run_id}-docker-stdout.log`);
    const content = await readFile(logPath, 'utf-8');
    expect(content).toBe('line 1\nline 2\n');
  });
});

describe('appendDockerStderr', () => {
  it('should create docker stderr log file', async () => {
    const created = await missionStore.createMission({ title: 'Test', type: 'feature', raw_input: 'test' });
    const run = await missionStore.createRun(created.mission_id, 'cleanup');

    await missionStore.appendDockerStderr(created.mission_id, run.run_id, 'error output\n');

    const logPath = join(testDir, 'missions', created.mission_id, 'logs', `${run.run_id}-docker-stderr.log`);
    expect(existsSync(logPath)).toBe(true);
    const content = await readFile(logPath, 'utf-8');
    expect(content).toBe('error output\n');
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] All tests pass: `pnpm --filter @haflow/backend test`
- [x] New tests specifically pass: `pnpm --filter @haflow/backend vitest run tests/unit/services/mission-store.test.ts`

#### Manual Verification:
- [x] Review test output to confirm new tests ran

---

## Testing Strategy

### Unit Tests:
- `appendDockerStdout` creates file and appends correctly
- `appendDockerStderr` creates file and appends correctly
- Functions handle missing logs directory (should create it)

### Integration Tests:
- Not adding integration tests for docker log capture (would require real Docker + Claude)
- Manual verification covers the integration path

### Manual Testing Steps:
1. Start backend: `pnpm --filter @haflow/backend dev`
2. Start frontend: `pnpm --filter frontend dev`
3. Create a new mission and trigger an agent step
4. Check `~/.haflow/missions/{missionId}/logs/` for the new log files
5. Verify content matches raw Docker output

## Performance Considerations

- Using read-then-write pattern per chunk may be slow for high-volume output
- Acceptable for now since Claude output is relatively low volume
- Future optimization: batch writes or switch to `appendFile` if performance issues arise

## References

- Research document: `thoughts/shared/research/2026-01-25-docker-logs-capture.md`
- Existing log implementation: `packages/backend/src/services/mission-store.ts:224-234`
- Docker spawn code: `packages/backend/src/services/docker.ts:344-377`
