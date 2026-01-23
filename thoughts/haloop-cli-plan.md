# haflow CLI Implementation Plan

## Overview

Implement `@haflow/cli` - a globally installable CLI (`haflow`) that simplifies running haflow locally. This is the **v0 blocker** with minimal commands and foreground-only operation.

## Current State Analysis

### What Exists
- Monorepo with `packages/shared`, `packages/backend`, `packages/frontend`
- Empty `packages/cli/` directory (not yet created)
- Root `dev` script that runs both backend + frontend: `pnpm --parallel --filter @haflow/backend --filter frontend dev`
- Backend on port 4000, frontend on port 5173
- Uses ESM (`"type": "module"`) throughout

### Key Discoveries
- Workspace at `pnpm-workspace.yaml` doesn't include CLI yet - needs update
- Backend package uses `tsx watch` for dev mode
- Root package.json has working `dev` script the CLI can leverage

## Desired End State

After implementation:
1. `npm install -g .` from `packages/cli` installs `haflow` command globally
2. `haflow init` creates `~/.haflow/` directory with config
3. `haflow link [path]` registers a project (one at a time, re-link replaces)
4. `haflow start` runs backend + frontend in foreground (Ctrl+C to stop)
5. `haflow status` shows running state + linked project

### Verification
```bash
haflow init
haflow link /path/to/project
haflow status
haflow start  # runs in foreground, Ctrl+C to stop
```

## What We're NOT Doing

- Background/daemon mode (v0 = foreground only)
- `stop` command (Ctrl+C handles this)
- `unlink` command (re-link replaces)
- Multiple linked projects (v0 = one at a time)
- SQLite database (JSON config only)
- Log file management
- Port configuration
- `--verbose`, `--json` flags

---

## Phase 1: Package Setup

### Overview
Create the CLI package structure and add to workspace.

### Changes Required

#### 1. Update workspace
**File**: `pnpm-workspace.yaml`
**Changes**: Add `packages/cli`

```yaml
packages:
  - packages/shared
  - packages/backend
  - packages/frontend
  - packages/cli
```

#### 2. Create package.json
**File**: `packages/cli/package.json`

```json
{
  "name": "@haflow/cli",
  "version": "0.1.0",
  "type": "module",
  "description": "CLI for haflow - local orchestrator",
  "bin": {
    "haflow": "./dist/index.js"
  },
  "main": "./dist/index.js",
  "files": ["dist"],
  "engines": {
    "node": ">=18.0.0"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "commander": "^13.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.8.3"
  }
}
```

#### 3. Create tsconfig.json
**File**: `packages/cli/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### 4. Create directory structure
```
packages/cli/
  src/
    index.ts      # CLI entry + all commands
    config.ts     # Config file read/write
```

### Success Criteria

#### Automated Verification
- [x] `pnpm install` succeeds from root
- [x] `cd packages/cli && pnpm build` compiles without errors

#### Manual Verification
- [x] Directory structure matches plan

---

## Phase 2: Config Module

### Overview
Implement config file management for storing linked project and initialization state.

### Changes Required

#### 1. Config module
**File**: `packages/cli/src/config.ts`

```typescript
import { homedir } from 'os';
import { join } from 'path';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

const haflow_HOME = process.env.haflow_HOME || join(homedir(), '.haflow');
const CONFIG_PATH = join(haflow_HOME, 'config.json');

interface Config {
  linkedProject?: string;
}

export const paths = {
  home: haflow_HOME,
  config: CONFIG_PATH,
};

export async function ensureHome(): Promise<void> {
  if (!existsSync(haflow_HOME)) {
    await mkdir(haflow_HOME, { recursive: true });
  }
}

export async function loadConfig(): Promise<Config> {
  try {
    return JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

export async function saveConfig(config: Config): Promise<void> {
  await ensureHome();
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}
```

### Success Criteria

#### Automated Verification
- [x] `pnpm build` succeeds
- [x] Config module exports correctly

---

## Phase 3: CLI Entry Point with All Commands

### Overview
Implement all 4 commands in a single entry file for simplicity.

### Changes Required

#### 1. CLI entry point
**File**: `packages/cli/src/index.ts`

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { spawn } from 'child_process';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { paths, ensureHome, loadConfig, saveConfig } from './config.js';

const program = new Command();

program.name('haflow').version('0.1.0');

// init
program
  .command('init')
  .description('Initialize ~/.haflow')
  .action(async () => {
    await ensureHome();
    console.log(`Initialized: ${paths.home}`);
  });

// link
program
  .command('link [path]')
  .description('Link a project')
  .action(async (path?: string) => {
    const target = resolve(path || process.cwd());

    // Validate it looks like a haflow-compatible project
    if (!existsSync(resolve(target, 'packages/backend'))) {
      console.error(`Not a valid project (missing packages/backend): ${target}`);
      process.exit(1);
    }

    await saveConfig({ linkedProject: target });
    console.log(`Linked: ${target}`);
  });

// start
program
  .command('start')
  .description('Start services')
  .action(async () => {
    const config = await loadConfig();

    if (!config.linkedProject || !existsSync(config.linkedProject)) {
      console.error('No project linked. Run: haflow link');
      process.exit(1);
    }

    console.log(`Starting haflow from: ${config.linkedProject}`);
    console.log('Backend:  http://localhost:4000');
    console.log('Frontend: http://localhost:5173');
    console.log('\nPress Ctrl+C to stop\n');

    // Run the existing dev script from linked project
    const child = spawn('pnpm', ['dev'], {
      cwd: config.linkedProject,
      stdio: 'inherit',
      shell: true,
    });

    child.on('error', (err) => console.error('Failed to start:', err.message));
  });

// status
program
  .command('status')
  .description('Show status')
  .action(async () => {
    const config = await loadConfig();

    console.log('haflow Status\n');
    console.log(`Home:    ${paths.home}`);
    console.log(`Project: ${config.linkedProject || '(none)'}`);

    // Simple port check
    const backendUp = await checkPort(4000);
    const frontendUp = await checkPort(5173);

    console.log(`\nBackend:  ${backendUp ? 'Running' : 'Stopped'} (port 4000)`);
    console.log(`Frontend: ${frontendUp ? 'Running' : 'Stopped'} (port 5173)`);
  });

async function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    import('net').then(({ createConnection }) => {
      const socket = createConnection(port, '127.0.0.1');
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('error', () => resolve(false));
      socket.setTimeout(500, () => {
        socket.destroy();
        resolve(false);
      });
    });
  });
}

program.parse();
```

### Success Criteria

#### Automated Verification
- [x] `pnpm build` succeeds
- [x] `node packages/cli/dist/index.js --help` shows all commands
- [x] `node packages/cli/dist/index.js init` creates ~/.haflow
- [x] `node packages/cli/dist/index.js link .` saves linked project
- [x] `node packages/cli/dist/index.js status` shows status

#### Manual Verification
- [ ] `haflow start` runs both services with combined output
- [ ] Ctrl+C stops both services
- [ ] Services accessible at localhost:4000 and localhost:5173

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that start works correctly before proceeding.

---

## Phase 4: Global Install & Testing

### Overview
Verify global installation works and run full end-to-end test.

### Changes Required

#### 1. Build and link globally
```bash
pnpm install
pnpm --filter @haflow/cli build

cd packages/cli && npm link
haflow --version
```

#### 2. Full test flow
```bash
# Test init
haflow init
cat ~/.haflow/config.json

# Test link (from project root)
haflow link .
haflow status

# Test start
haflow start
# Wait for services to start, then Ctrl+C

# Verify status after stopping
haflow status
```

### Success Criteria

#### Automated Verification
- [ ] `pnpm --filter @haflow/cli build` succeeds
- [ ] `npm link` completes without errors
- [ ] `haflow --version` outputs 0.1.0

#### Manual Verification
- [ ] `haflow init` creates `~/.haflow`
- [ ] `haflow link` saves project path to config
- [ ] `haflow start` runs both backend + frontend (foreground)
- [ ] `haflow status` shows linked project + port status
- [ ] Services accessible at localhost:4000 and localhost:5173

---

## Testing Strategy

### Manual Testing Steps
1. Clean slate: `rm -rf ~/.haflow`
2. `haflow init` - verify directory created
3. `haflow status` - should show no project linked
4. `haflow link` from project directory - verify config updated
5. `haflow status` - should show linked project
6. `haflow start` - verify both services start
7. Open browser to localhost:5173 - verify frontend loads
8. Ctrl+C - verify clean shutdown
9. `haflow status` - verify shows stopped

### Edge Cases
- `haflow start` without init: should error
- `haflow link` on invalid directory: should error
- `haflow start` without link: should error
- Re-linking replaces previous project

---

## File Summary

```
packages/cli/
  package.json
  tsconfig.json
  src/
    index.ts      # CLI entry + all commands (~80 lines)
    config.ts     # Config read/write (~30 lines)
```

Total new code: ~110 lines TypeScript

---

## References

- High-level spec: `/home/s-linux/projects/ralphy/haflow-cli-high-level.md`
- Existing detailed plan: `thoughts/shared/plans/2026-01-23-cli-v0-implementation.md`
- Backend package: `packages/backend/package.json`
- Root dev script: `package.json:16` (`pnpm dev`)
