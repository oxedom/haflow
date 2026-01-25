---
date: 2026-01-25T12:00:00-08:00
researcher: Claude
git_commit: 827e66d025945f24264d460d891eb93042e71464
branch: main
repository: haflow
topic: "Docker Logs Capture Implementation Research"
tags: [research, codebase, docker, logging, mission-engine, streaming]
status: complete
last_updated: 2026-01-25
last_updated_by: Claude
---

# Research: Docker Logs Capture Implementation

**Date**: 2026-01-25T12:00:00-08:00
**Researcher**: Claude
**Git Commit**: 827e66d025945f24264d460d891eb93042e71464
**Branch**: main
**Repository**: haflow

## Research Question

How should we implement Docker logs capture - capturing raw container output (visible in Docker Desktop) to a `docker-logs.txt` file within each mission's run directory for debugging and auditing?

## Summary

The codebase has two distinct execution modes with different logging needs:

1. **Claude Streaming Mode** (`startClaudeStreaming`) - Uses `spawn()` with piped stdout/stderr and readline for line-by-line JSON parsing. Raw container output is transformed into `StreamEvent` objects before reaching the mission-engine. **Stderr is only captured in memory for error reporting, never persisted.**

2. **Mock Agent Mode** (`start()` + polling) - Uses `docker logs --tail 100` via `execAsync()` every 1 second. Merges stdout/stderr with `2>&1`. **Logs are already captured but may miss early output due to polling start delay.**

Key insight: **Neither mode currently captures the raw, untransformed Docker container output before JSON parsing.** The existing `logs/r-{runId}.log` files contain parsed/formatted Claude output, not raw Docker output.

## Detailed Findings

### Current Log Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLAUDE STREAMING MODE                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Container stdout ─────┬───► readline ───► parseStreamJsonLine() ───►│
│  (stream-json format)  │                           │                 │
│                        │                           ▼                 │
│                        │                    StreamEvent objects      │
│                        │                           │                 │
│                        │                           ▼                 │
│                        │                    mission-engine.ts        │
│                        │                    (buffers event.text)     │
│                        │                           │                 │
│                        │                           ▼                 │
│                        │                    logs/r-{runId}.log       │
│                        │                    (FORMATTED output)       │
│                        │                                             │
│  Container stderr ─────┴───► stderrOutput buffer (memory only)      │
│                              (only used in error messages)           │
│                                                                      │
│  ❌ RAW DOCKER OUTPUT IS LOST (not captured to file)                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                          MOCK AGENT MODE                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Container runs in detached mode (-d flag)                          │
│        │                                                             │
│        ▼                                                             │
│  monitorContainer() polls every 1000ms                              │
│        │                                                             │
│        ├───► provider.getLogTail()                                  │
│        │     • docker logs --tail 100 {containerId} 2>&1            │
│        │     • Returns merged stdout+stderr (last 2000 bytes)       │
│        │                                                             │
│        └───► missionStore.appendLog()                               │
│              • Appends to logs/r-{runId}.log                        │
│                                                                      │
│  ⚠️  ISSUES:                                                        │
│  • Polling starts AFTER container starts (may miss early output)    │
│  • May duplicate logs (no dedup on append)                          │
│  • Limited to last 100 lines per poll                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Touch Points for Docker Logs Implementation

#### 1. `docker.ts` - Container Output Reading

**Location**: `packages/backend/src/services/docker.ts`

**Claude Streaming Mode** (lines 281-463):
```typescript
// Line 344: Container spawned with piped stdio
const childProcess = spawn('docker', args, {
  stdio: ['ignore', 'pipe', 'pipe'],  // stdin=ignore, stdout=pipe, stderr=pipe
});

// Lines 349-352: Stderr captured but only in memory
let stderrOutput = '';
childProcess.stderr.on('data', (data) => {
  stderrOutput += data.toString();
});

// Lines 354-377: Stdout goes through readline → JSON parsing
const rl = readline.createInterface({
  input: childProcess.stdout,
  crlfDelay: Infinity,
});

for await (const line of rl) {
  const event = parseStreamJsonLine(line);  // Transforms raw output
  if (event) {
    yield event;
  }
}
```

**Key insight**: Raw stdout lines are immediately parsed. There's no hook to capture the raw line before transformation.

**Mock/Detached Mode** (lines 139-146):
```typescript
async function getLogTail(containerId: string, bytes = 2000): Promise<string> {
  const { stdout } = await execAsync(`docker logs --tail 100 ${containerId} 2>&1`);
  return stdout.slice(-bytes);
}
```

#### 2. `mission-engine.ts` - Run Orchestration

**Location**: `packages/backend/src/services/mission-engine.ts`

**Claude Streaming Log Capture** (lines 169-183):
```typescript
for await (const event of stream) {
  if (event.text) {
    logBuffer += event.text + '\n';
    if (logBuffer.length > 500) {
      await missionStore.appendLog(missionId, runId, logBuffer);
      logBuffer = '';
    }
  }
  // Tool use events also logged
}
```

The mission-engine only sees `StreamEvent` objects, not raw Docker output.

#### 3. `mission-store.ts` - Log Persistence

**Location**: `packages/backend/src/services/mission-store.ts`

**Log Directory** (line 13):
```typescript
const logsDir = (missionId: string) => join(missionDir(missionId), 'logs');
```

**Append Function** (lines 224-234):
```typescript
async function appendLog(missionId: string, runId: string, data: string): Promise<void> {
  const dir = logsDir(missionId);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  const path = join(dir, `${runId}.log`);

  const existing = existsSync(path) ? await readFile(path, 'utf-8') : '';
  await writeFile(path, existing + data);  // Read-then-write pattern
}
```

### Proposed File Location

Per the feature spec in `thoughts/shared/ha.md`:

```
missions/
  {mission-id}/
    runs/
      {run-id}/
        logs.txt          # (existing) parsed/formatted logs
        docker-logs.txt   # (new) raw container output
```

**Current implementation** uses a different structure:
```
missions/
  {mission-id}/
    logs/                 # Flat directory
      {run-id}.log        # Formatted logs
```

**Decision needed**: Match the spec's nested structure or adapt to current flat structure:
- Option A: `logs/{run-id}.log` (formatted) + `logs/{run-id}-docker.log` (raw)
- Option B: `runs/{run-id}/logs.txt` + `runs/{run-id}/docker-logs.txt` (requires migration)

## Code References

- `packages/backend/src/services/docker.ts:344` - Container spawn with piped stdio
- `packages/backend/src/services/docker.ts:349-352` - Stderr capture (memory only)
- `packages/backend/src/services/docker.ts:354-377` - Stdout readline processing
- `packages/backend/src/services/docker.ts:139-146` - `getLogTail()` for detached mode
- `packages/backend/src/services/mission-engine.ts:159-192` - Stream event processing
- `packages/backend/src/services/mission-engine.ts:169-183` - Log buffering logic
- `packages/backend/src/services/mission-engine.ts:287-331` - Container monitor polling
- `packages/backend/src/services/mission-store.ts:13` - Logs directory path
- `packages/backend/src/services/mission-store.ts:224-234` - `appendLog()` function

## Architecture Insights

### Existing Logging Pattern

The codebase uses a consistent read-then-write pattern via `writeFile`:
- No `appendFile` or `createWriteStream` usage
- No log rotation or size limits
- 500-char buffer threshold for streaming logs
- 2000-byte default tail for reading

### Performance Considerations (from spec)

1. **Non-blocking writes**: Raw log capture shouldn't block the streaming pipeline
2. **File size**: Raw `stream-json` is verbose; may need rotation
3. **Timing**: Capture should start BEFORE Claude invocation

### Implementation Approaches

**Approach A: Tee at spawn level in docker.ts**
```typescript
// Create write stream BEFORE spawning
const dockerLogStream = createWriteStream(dockerLogPath);

const childProcess = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });

// Tee stdout to both readline and file
childProcess.stdout.on('data', (chunk) => dockerLogStream.write(chunk));

// Also capture stderr
childProcess.stderr.on('data', (chunk) => dockerLogStream.write(chunk));
```

**Pros**: Captures everything, non-blocking, starts before first output
**Cons**: Requires passing log path into `startClaudeStreaming()`

**Approach B: Parallel write in mission-engine event loop**
```typescript
for await (const event of stream) {
  // Write raw event to docker log
  await appendDockerLog(missionId, runId, JSON.stringify(event));
  // ... existing processing
}
```

**Pros**: Simple, uses existing patterns
**Cons**: Only captures parsed events, not raw Docker output or stderr

**Approach C: Add rawLine field to StreamEvent**
```typescript
// In docker.ts parseStreamJsonLine
return { ...event, rawLine: line };

// In mission-engine
if (event.rawLine) {
  await appendDockerLog(missionId, runId, event.rawLine);
}
```

**Pros**: Preserves raw JSON lines
**Cons**: Doesn't capture non-JSON lines or stderr

## Open Questions

1. **File location**: Adapt to existing flat `logs/` structure or migrate to spec's nested `runs/{run-id}/` structure?

2. **Stderr handling**: Should docker-logs.txt include stderr? Currently stderr is only captured in memory and discarded on success.

3. **Non-JSON lines**: The current parser skips non-JSON lines (docker startup messages). Should these be captured?

4. **Size limits**: Should docker-logs.txt have rotation/size limits? Current logs have none.

5. **Mock mode**: Should mock agent runs also capture docker logs? They use different capture mechanism (polling).

6. **Concurrent writes**: The read-then-write pattern isn't atomic. Is this a concern for docker logs that may be written frequently?

## Recommendations for Planning

1. **Implement at docker.ts level** (Approach A) for true raw capture
2. **Use WriteStream** for non-blocking appends instead of read-then-write
3. **Capture both stdout and stderr** to the docker-logs file
4. **Start capture before spawn** to catch all container initialization
5. **Consider flat structure**: `logs/{run-id}-docker.log` for minimal changes
6. **Add to ClaudeSandboxOptions interface**: Pass `dockerLogPath` parameter
