import { existsSync, readFileSync, unlinkSync } from 'fs'
import chalk from 'chalk'
import ora from 'ora'
import { RALPHY_HOME, SERVER_PID_PATH } from '../lib/paths.js'
import { configExists } from '../lib/config.js'

export interface StopResult {
  success: boolean
  notRunning?: boolean
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

export async function stopCommand(): Promise<StopResult> {
  const spinner = ora()

  // Verify Ralphy is initialized
  if (!existsSync(RALPHY_HOME) || !configExists()) {
    console.log(chalk.red('Ralphy is not initialized.'))
    console.log(chalk.dim('Run: ralphy init'))
    return { success: false, error: 'Ralphy not initialized' }
  }

  // Check if PID file exists
  if (!existsSync(SERVER_PID_PATH)) {
    console.log(chalk.yellow('Server is not running'))
    return { success: true, notRunning: true }
  }

  let pid: number
  try {
    pid = parseInt(readFileSync(SERVER_PID_PATH, 'utf-8').trim(), 10)
    if (isNaN(pid)) {
      // Invalid PID file, clean it up
      unlinkSync(SERVER_PID_PATH)
      console.log(chalk.yellow('Server is not running'))
      return { success: true, notRunning: true }
    }
  } catch {
    console.log(chalk.yellow('Server is not running'))
    return { success: true, notRunning: true }
  }

  // Check if process is actually running
  if (!isProcessRunning(pid)) {
    // Process not running, clean up PID file
    unlinkSync(SERVER_PID_PATH)
    console.log(chalk.yellow('Server is not running'))
    return { success: true, notRunning: true }
  }

  // Stop the process
  spinner.start('Stopping server...')
  try {
    process.kill(pid, 'SIGTERM')

    // Wait for process to stop
    let attempts = 0
    const maxAttempts = 50 // 5 seconds
    while (isProcessRunning(pid) && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++
    }

    // Force kill if still running
    if (isProcessRunning(pid)) {
      process.kill(pid, 'SIGKILL')
    }

    // Clean up PID file
    if (existsSync(SERVER_PID_PATH)) {
      unlinkSync(SERVER_PID_PATH)
    }

    spinner.succeed(chalk.green('Server stopped'))
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    // Clean up PID file even on error
    if (existsSync(SERVER_PID_PATH)) {
      unlinkSync(SERVER_PID_PATH)
    }

    if ((error as NodeJS.ErrnoException).code === 'ESRCH') {
      // Process doesn't exist
      spinner.succeed(chalk.green('Server stopped'))
      return { success: true }
    }

    spinner.fail(`Failed to stop server: ${message}`)
    return { success: false, error: message }
  }
}
