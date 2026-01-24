# Plan: Pass .claude Skills to Docker Sandbox Containers

## Summary

Enable Claude agents running in Docker sandbox containers to access skills/agents/commands by:
1. Copying this project's `.claude` directory to `~/.haflow/.claude` during initialization
2. Mounting `~/.claude`into containers



## Implementation

### 1. Add .claude copying during haflow init (`config.ts` or new `init.ts`)

When haflow starts, copy `.claude` from the project to `~/.haflow/.claude`:

```typescript
import { cpSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

async function initClaudeConfig(): Promise<void> {
  const sourceClaudeDir = join(process.cwd(), '.claude');
  const destClaudeDir = join(config.haflowHome, '.claude');

  if (existsSync(sourceClaudeDir)) {
    // Create parent directory if needed
    mkdirSync(destClaudeDir, { recursive: true });
    // Copy recursively, overwriting existing
    cpSync(sourceClaudeDir, destClaudeDir, { recursive: true });
  }
}
```

### 2. Add `claudeDir` getter to `config.ts`

```typescript
get claudeDir() {
  return join(this.haflowHome, '.claude');
}
```

### 3. Update `ClaudeSandboxOptions` interface (`sandbox.ts`)

Add optional `claudeConfigPath` field:

```typescript
export interface ClaudeSandboxOptions {
  missionId: string;
  runId: string;
  stepId: string;
  artifactsPath: string;
  prompt: string;
  claudeConfigPath?: string;  // Host path to .claude directory
}
```

### 4. Update `startClaudeStreaming()` in `docker.ts`

Add volume mount for .claude if provided:

```typescript
async function* startClaudeStreaming(options: ClaudeSandboxOptions) {
  const { artifactsPath, prompt, claudeConfigPath } = options;

  const args = [
    'sandbox', 'run',
    '-w', artifactsPath,
    ...(claudeConfigPath ? ['-v', `${claudeConfigPath}:/home/agent/.claude:ro`] : []),
    '--credentials', 'host',
    'claude',
    '--print',
    '--output-format', 'stream-json',
    '--dangerously-skip-permissions',
    prompt,
  ];
  // ... rest unchanged
}
```

### 5. Update `mission-engine.ts` to pass .claude path

In `runClaudeStreaming()`:

```typescript
import { existsSync } from 'fs';

// Check if .claude directory exists in haflow home
const claudeConfigPath = existsSync(config.claudeDir) ? config.claudeDir : undefined;

// Pass to provider
for await (const event of provider.startClaudeStreaming!({
  missionId,
  runId,
  stepId: step.step_id,
  artifactsPath,
  prompt,
  claudeConfigPath,
})) {
  // ... existing logic
}
```

### 6. Call init during backend startup (`index.ts`)

Add call to `initClaudeConfig()` during server initialization.

## Files to Modify

1. `packages/backend/src/config.ts` - Add `claudeDir` getter + `initClaudeConfig()` function
2. `packages/backend/src/services/sandbox.ts` - Add `claudeConfigPath` to interface
3. `packages/backend/src/services/docker.ts` - Add `-v` mount in `startClaudeStreaming()`
4. `packages/backend/src/services/mission-engine.ts` - Pass claudeConfigPath
5. `packages/backend/src/index.ts` - Call `initClaudeConfig()` on startup

## Directory Structure After Init

```
~/.haflow/
  .claude/                  # Copied from project
    agents/
    commands/
    skills/
    settings.json
  missions/
    m-<uuid>/
      artifacts/
      ...
```

## Mount Details

- **Host path**: `~/.haflow/.claude`
- **Container path**: `/home/agent/.claude`
- **Mode**: Read-only (`:ro`)

## Notes

- Copy happens on every backend startup (overwrites to stay in sync)
- Read-only mount prevents agents from modifying skills
- If source `.claude` doesn't exist, nothing is copied
- The `--credentials host` flag handles API keys separately
