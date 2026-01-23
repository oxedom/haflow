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
    .action(async (path) => {
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
async function checkPort(port) {
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
