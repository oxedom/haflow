# haflow CLI Implementation Plan

## Overview

Implement `@haflow/cli` - a globally installable CLI (`haflow`) that simplifies running haflow locally. This is the **only v0 blocker**.

## Required Commands (from spec)

| Command | Purpose |
|---------|---------|
| `init` | Create `~/.haflow` directory structure |
| `link [path]` | Register a project path (one at a time, re-link replaces) |
| `start` | Start backend + frontend |
| `status` | Show running state + linked project |

## Design Decisions

### Keep It Simple
- **Foreground processes** - `start` runs services in foreground (Ctrl+C to stop)
- **Leverage existing scripts** - root `package.json` already has `dev` script that runs both

### Minimal Dependencies
- **commander** - CLI framework
- **execa** - Process spawning (optional, could use native `spawn`)

## Implementation

### Package Setup

**Add to `pnpm-workspace.yaml`:**
```yaml
packages:
  - packages/cli
```

**`packages/cli/package.json`:**
```json
{
  "name": "@haflow/cli",
  "version": "0.1.0",
  "type": "module",
  "bin": { "haflow": "./dist/index.js" },
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

### File Structure
```
packages/cli/src/
├── index.ts      # CLI entry + all commands (single file is fine for v0)
└── config.ts     # Config file read/write
```

### Core Logic

**`src/config.ts`** - Simple JSON config:
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

**`src/index.ts`** - All commands:
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
program.command('init').description('Initialize ~/.haflow').action(async () => {
  await ensureHome();
  console.log(`Initialized: ${paths.home}`);
});

// link
program.command('link [path]').description('Link a project').action(async (path?: string) => {
  const target = resolve(path || process.cwd());

  if (!existsSync(resolve(target, 'packages/backend'))) {
    console.error(`Not a haflow project: ${target}`);
    process.exit(1);
  }

  await saveConfig({ linkedProject: target });
  console.log(`Linked: ${target}`);
});

// start
program.command('start').description('Start services').action(async () => {
  const config = await loadConfig();

  if (!config.linkedProject || !existsSync(config.linkedProject)) {
    console.error('No project linked. Run: haflow link');
    process.exit(1);
  }

  console.log(`Starting haflow from: ${config.linkedProject}`);
  console.log('Backend:  http://localhost:4000');
  console.log('Frontend: http://localhost:5173');
  console.log('\nPress Ctrl+C to stop\n');

  // Run the existing dev script
  const child = spawn('pnpm', ['dev'], {
    cwd: config.linkedProject,
    stdio: 'inherit',
    shell: true,
  });

  child.on('error', (err) => console.error('Failed to start:', err.message));
});

// status
program.command('status').description('Show status').action(async () => {
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
      socket.on('connect', () => { socket.destroy(); resolve(true); });
      socket.on('error', () => resolve(false));
      socket.setTimeout(500, () => { socket.destroy(); resolve(false); });
    });
  });
}

program.parse();
```

## Testing

```bash
# Build
pnpm install
pnpm --filter @haflow/cli build

# Test locally
node packages/cli/dist/index.js init
node packages/cli/dist/index.js link .
node packages/cli/dist/index.js status
node packages/cli/dist/index.js start  # runs in foreground

# Test global install
cd packages/cli && npm link
haflow --version
haflow init
haflow link /path/to/project
haflow start
```

## Success Criteria

- [ ] `haflow init` creates `~/.haflow`
- [ ] `haflow link` saves project path to config
- [ ] `haflow start` runs both backend + frontend (foreground)
- [ ] `haflow status` shows linked project + port status
- [ ] Services accessible at localhost:4000 and localhost:5173

## Future (Post-v0)

- Background process management with PIDs
- `haflow stop` command
- Log file management
- Port configuration
