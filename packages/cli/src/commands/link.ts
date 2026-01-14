import { existsSync, mkdirSync, statSync } from 'fs'
import { resolve, basename } from 'path'
import chalk from 'chalk'
import ora from 'ora'
import { v4 as uuidv4 } from 'uuid'
import { RALPHY_HOME, getProjectRalphyDir } from '../lib/paths.js'
import { configExists } from '../lib/config.js'
import { getCliDatabase, closeCliDatabase } from '../lib/database.js'

interface ProjectRow {
  id: string
  name: string
  path: string
  is_active: number
  created_at: string
  updated_at: string
}

export interface LinkOptions {
  name?: string
}

export interface LinkResult {
  success: boolean
  projectId?: string
  alreadyLinked?: boolean
  error?: string
}

function isGitRepository(path: string): boolean {
  return existsSync(resolve(path, '.git'))
}

export async function linkCommand(pathArg: string | undefined, options: LinkOptions): Promise<LinkResult> {
  const spinner = ora()
  const projectPath = resolve(pathArg || process.cwd())

  // Verify Ralphy is initialized
  if (!existsSync(RALPHY_HOME) || !configExists()) {
    console.log(chalk.red('Ralphy is not initialized.'))
    console.log(chalk.dim('Run: ralphy init'))
    return { success: false, error: 'Ralphy not initialized' }
  }

  // Verify path is a valid directory
  if (!existsSync(projectPath)) {
    console.log(chalk.red(`Directory does not exist: ${projectPath}`))
    return { success: false, error: 'Directory does not exist' }
  }

  try {
    const stats = statSync(projectPath)
    if (!stats.isDirectory()) {
      console.log(chalk.red(`Path is not a directory: ${projectPath}`))
      return { success: false, error: 'Path is not a directory' }
    }
  } catch {
    console.log(chalk.red(`Cannot access path: ${projectPath}`))
    return { success: false, error: 'Cannot access path' }
  }

  // Warn if not a git repository
  if (!isGitRepository(projectPath)) {
    console.log(chalk.yellow('Warning:'), 'This directory is not a git repository')
  }

  const projectName = options.name || basename(projectPath)

  // Check if already linked
  const db = getCliDatabase()
  try {
    const existing = db.prepare('SELECT * FROM projects WHERE path = ?').get(projectPath) as ProjectRow | undefined
    if (existing) {
      if (existing.is_active === 1) {
        console.log(chalk.yellow('Project already linked:'), chalk.cyan(existing.name))
        console.log(chalk.dim(`ID: ${existing.id}`))
        closeCliDatabase()
        return { success: true, alreadyLinked: true, projectId: existing.id }
      } else {
        // Reactivate the project
        spinner.start('Reactivating project...')
        const now = new Date().toISOString()
        db.prepare('UPDATE projects SET is_active = 1, name = ?, updated_at = ? WHERE id = ?')
          .run(projectName, now, existing.id)
        spinner.succeed(chalk.green(`Reactivated project "${projectName}"`))
        closeCliDatabase()
        return { success: true, projectId: existing.id }
      }
    }

    // Create project directory
    const projectRalphyDir = getProjectRalphyDir(projectPath)
    spinner.start('Creating .ralphy/ directory...')
    mkdirSync(projectRalphyDir, { recursive: true })
    mkdirSync(resolve(projectRalphyDir, 'missions'), { recursive: true })
    spinner.succeed(chalk.green('Created .ralphy/ directory'))

    // Register project in database
    spinner.start('Registering project...')
    const projectId = uuidv4()
    const now = new Date().toISOString()
    db.prepare(`
      INSERT INTO projects (id, name, path, is_active, created_at, updated_at)
      VALUES (?, ?, ?, 1, ?, ?)
    `).run(projectId, projectName, projectPath, now, now)
    spinner.succeed(chalk.green(`Registered project "${projectName}"`))

    closeCliDatabase()

    console.log('')
    console.log(chalk.green.bold('Project linked!'), `ID: ${chalk.cyan(projectId)}`)
    console.log('')

    return { success: true, projectId }
  } catch (error) {
    closeCliDatabase()
    const message = error instanceof Error ? error.message : 'Unknown error'
    spinner.fail(`Failed to link project: ${message}`)
    return { success: false, error: message }
  }
}
