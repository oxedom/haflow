#!/usr/bin/env node
import { program } from 'commander'
import { initCommand } from './commands/init.js'
import { linkCommand } from './commands/link.js'
import { unlinkCommand } from './commands/unlink.js'
import { startCommand } from './commands/start.js'
import { stopCommand } from './commands/stop.js'
import { statusCommand } from './commands/status.js'

program
  .name('ralphy')
  .description('Central hub for managing Claude Code missions')
  .version('0.0.1')

program
  .command('init')
  .description('Initialize Ralphy on this machine')
  .option('--force', 'Reinitialize even if exists')
  .action(async (options) => {
    const result = await initCommand(options)
    process.exit(result.success ? 0 : 1)
  })

program
  .command('link [path]')
  .description('Link a project to Ralphy')
  .option('--name <name>', 'Custom project name')
  .action(async (path, options) => {
    const result = await linkCommand(path, options)
    process.exit(result.success ? 0 : 1)
  })

program
  .command('unlink [path]')
  .description('Unlink a project from Ralphy')
  .option('--remove-dir', 'Remove .ralphy directory')
  .option('--hard', 'Permanently delete from database')
  .action(async (path, options) => {
    const result = await unlinkCommand(path, options)
    process.exit(result.success ? 0 : 1)
  })

program
  .command('start')
  .description('Start the Ralphy backend server')
  .option('--port <port>', 'Override port')
  .option('--daemon', 'Run in background')
  .option('--verbose', 'Show detailed logs')
  .action(async (options) => {
    const result = await startCommand(options)
    // Don't exit on success for foreground server
    if (!result.success) {
      process.exit(1)
    }
  })

program
  .command('stop')
  .description('Stop the Ralphy backend server')
  .action(async () => {
    const result = await stopCommand()
    process.exit(result.success ? 0 : 1)
  })

program
  .command('status')
  .description('Show Ralphy status and linked projects')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await statusCommand(options)
    process.exit(0)
  })

program.parse()
