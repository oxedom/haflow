import { existsSync, writeFileSync, readFileSync } from 'fs'
import { spawn } from 'child_process'
import chalk from 'chalk'
import ora from 'ora'
import { RALPHY_HOME, SERVER_PID_PATH } from '../lib/paths.js'
import { configExists, loadGlobalConfig } from '../lib/config.js'
import { createApp, getDatabase } from '@ralphy/backend'

export interface StartOptions {
  port?: string
  daemon?: boolean
  verbose?: boolean
}

export interface StartResult {
  success: boolean
  port?: number
  pid?: number
  alreadyRunning?: boolean
  error?: string
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function getRunningPid(): number | null {
  if (!existsSync(SERVER_PID_PATH)) {
    return null
  }

  try {
    const pid = parseInt(readFileSync(SERVER_PID_PATH, 'utf-8').trim(), 10)
    if (isNaN(pid)) {
      return null
    }
    return isProcessRunning(pid) ? pid : null
  } catch {
    return null
  }
}

export async function startCommand(options: StartOptions): Promise<StartResult> {
  const spinner = ora()

  // Verify Ralphy is initialized
  if (!existsSync(RALPHY_HOME) || !configExists()) {
    console.log(chalk.red('Ralphy is not initialized.'))
    console.log(chalk.dim('Run: ralphy init'))
    return { success: false, error: 'Ralphy not initialized' }
  }

  // Check if already running
  const existingPid = getRunningPid()
  if (existingPid) {
    console.log(chalk.yellow('Server is already running'), chalk.dim(`(PID: ${existingPid})`))
    return { success: true, alreadyRunning: true, pid: existingPid }
  }

  const config = loadGlobalConfig()
  const port = options.port ? parseInt(options.port, 10) : config?.server.port || 3847
  const host = config?.server.host || '127.0.0.1'

  if (options.daemon) {
    // Run in background
    spinner.start('Starting server in background...')
    try {
      const child = spawn(process.execPath, [process.argv[1] || '', 'start', '--port', String(port)], {
        detached: true,
        stdio: 'ignore',
        env: {
          ...process.env,
          RALPHY_DAEMON: '1'
        }
      })

      child.unref()

      if (child.pid) {
        writeFileSync(SERVER_PID_PATH, String(child.pid))
        spinner.succeed(chalk.green(`Server started in background (PID: ${child.pid})`))
        console.log('')
        console.log(chalk.dim('Stop with: ralphy stop'))
        return { success: true, port, pid: child.pid }
      } else {
        spinner.fail('Failed to start background process')
        return { success: false, error: 'Failed to start background process' }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      spinner.fail(`Failed to start server: ${message}`)
      return { success: false, error: message }
    }
  }

  // Run in foreground
  spinner.start('Starting server...')
  try {
    // Initialize database
    getDatabase()

    const app = createApp({ enableLogging: options.verbose })

    return new Promise((resolve) => {
      const server = app.listen(port, host, () => {
        spinner.succeed(chalk.green(`Ralphy running at http://${host}:${port}`))
        console.log('')
        console.log(chalk.dim('Press Ctrl+C to stop'))

        // Write PID for tracking
        writeFileSync(SERVER_PID_PATH, String(process.pid))

        // Handle graceful shutdown
        const cleanup = () => {
          console.log('')
          console.log(chalk.dim('Shutting down...'))
          server.close()
          if (existsSync(SERVER_PID_PATH)) {
            const fs = require('fs')
            fs.unlinkSync(SERVER_PID_PATH)
          }
          process.exit(0)
        }

        process.on('SIGINT', cleanup)
        process.on('SIGTERM', cleanup)
      })

      server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          spinner.fail(chalk.red(`Port ${port} is already in use`))
          console.log(chalk.dim(`Try: ralphy start --port <other-port>`))
          resolve({ success: false, error: `Port ${port} is already in use` })
        } else {
          spinner.fail(`Server error: ${error.message}`)
          resolve({ success: false, error: error.message })
        }
      })
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    spinner.fail(`Failed to start server: ${message}`)
    return { success: false, error: message }
  }
}
