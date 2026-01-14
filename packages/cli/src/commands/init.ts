import { existsSync, mkdirSync, rmSync } from 'fs'
import chalk from 'chalk'
import ora from 'ora'
import { RALPHY_HOME, LOGS_DIR } from '../lib/paths.js'
import { getDefaultConfig, saveGlobalConfig, configExists } from '../lib/config.js'
import { getCliDatabase, closeCliDatabase, databaseExists } from '../lib/database.js'

export interface InitOptions {
  force?: boolean
}

export interface InitResult {
  success: boolean
  alreadyInitialized?: boolean
  reinitialized?: boolean
  error?: string
}

export async function initCommand(options: InitOptions): Promise<InitResult> {
  const spinner = ora()

  const isInitialized = existsSync(RALPHY_HOME) && configExists() && databaseExists()

  if (isInitialized && !options.force) {
    console.log(chalk.yellow('Ralphy is already initialized at'), chalk.cyan(RALPHY_HOME))
    console.log(chalk.dim('Use --force to reinitialize'))
    return { success: true, alreadyInitialized: true }
  }

  if (options.force && isInitialized) {
    spinner.start('Removing existing installation...')
    try {
      closeCliDatabase()
      rmSync(RALPHY_HOME, { recursive: true, force: true })
      spinner.succeed('Removed existing installation')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      spinner.fail(`Failed to remove existing installation: ${message}`)
      return { success: false, error: message }
    }
  }

  // Create ~/.ralphy/ directory
  spinner.start('Creating ~/.ralphy/ directory...')
  try {
    mkdirSync(RALPHY_HOME, { recursive: true })
    mkdirSync(LOGS_DIR, { recursive: true })
    spinner.succeed(chalk.green('Created ~/.ralphy/'))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Permission denied'
    spinner.fail(`Failed to create directory: ${message}`)
    return { success: false, error: message }
  }

  // Create config.json
  spinner.start('Initializing config.json...')
  try {
    const config = getDefaultConfig()
    saveGlobalConfig(config)
    spinner.succeed(chalk.green('Initialized config.json'))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    spinner.fail(`Failed to create config: ${message}`)
    return { success: false, error: message }
  }

  // Initialize database
  spinner.start('Creating database...')
  try {
    getCliDatabase()
    closeCliDatabase()
    spinner.succeed(chalk.green('Created database'))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    spinner.fail(`Failed to create database: ${message}`)
    return { success: false, error: message }
  }

  // Success message
  console.log('')
  console.log(chalk.green.bold('Ralphy initialized!'), 'Next steps:')
  console.log(chalk.dim('  cd <your-project>'))
  console.log(chalk.dim('  ralphy link'))
  console.log('')

  return { success: true, reinitialized: options.force }
}
