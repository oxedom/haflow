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

    // Resolve haflow root (CLI is at packages/cli, go up 2 levels)
    const haflowRoot = resolve(import.meta.dirname, '..', '..', '..');

    console.log(`Starting haflow services...`);
    console.log(`Linked project: ${config.linkedProject}`);
    console.log('Backend:  http://localhost:4000');
    console.log('Frontend: http://localhost:5173');
    console.log('\nPress Ctrl+C to stop\n');

    // Run haflow's own dev servers, not the linked project's
    const child = spawn('pnpm', ['dev'], {
      cwd: haflowRoot,
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
