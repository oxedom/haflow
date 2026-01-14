import { existsSync, rmSync } from 'fs'
import { resolve } from 'path'
import chalk from 'chalk'
import ora from 'ora'
import { RALPHY_HOME, getProjectRalphyDir } from '../lib/paths.js'
import { configExists } from '../lib/config.js'
import { getCliDatabase, closeCliDatabase } from '../lib/database.js'
import type { Project } from '@ralphy/shared'

export interface UnlinkOptions {
  removeDir?: boolean
  hard?: boolean
}

export interface UnlinkResult {
  success: boolean
  notLinked?: boolean
  error?: string
}

export async function unlinkCommand(pathArg: string | undefined, options: UnlinkOptions): Promise<UnlinkResult> {
  const spinner = ora()
  const projectPath = resolve(pathArg || process.cwd())

  // Verify Ralphy is initialized
  if (!existsSync(RALPHY_HOME) || !configExists()) {
    console.log(chalk.red('Ralphy is not initialized.'))
    console.log(chalk.dim('Run: ralphy init'))
    return { success: false, error: 'Ralphy not initialized' }
  }

  const db = getCliDatabase()
  try {
    const existing = db.prepare('SELECT * FROM projects WHERE path = ?').get(projectPath) as Project | undefined

    if (!existing) {
      console.log(chalk.yellow('Project is not linked:'), chalk.dim(projectPath))
      closeCliDatabase()
      return { success: true, notLinked: true }
    }

    if (!existing.isActive && !options.hard) {
      console.log(chalk.yellow('Project is already unlinked:'), chalk.dim(existing.name))
      closeCliDatabase()
      return { success: true, notLinked: true }
    }

    if (options.hard) {
      // Permanently delete from database
      spinner.start('Permanently deleting project...')
      db.prepare('DELETE FROM projects WHERE id = ?').run(existing.id)
      spinner.succeed(chalk.green(`Permanently deleted project "${existing.name}"`))
    } else {
      // Soft delete - set inactive
      spinner.start('Unlinking project...')
      const now = new Date().toISOString()
      db.prepare('UPDATE projects SET is_active = 0, updated_at = ? WHERE id = ?')
        .run(now, existing.id)
      spinner.succeed(chalk.green(`Unlinked project "${existing.name}"`))
    }

    // Optionally remove .ralphy/ directory
    if (options.removeDir) {
      const projectRalphyDir = getProjectRalphyDir(projectPath)
      if (existsSync(projectRalphyDir)) {
        spinner.start('Removing .ralphy/ directory...')
        rmSync(projectRalphyDir, { recursive: true, force: true })
        spinner.succeed(chalk.green('Removed .ralphy/ directory'))
      }
    }

    closeCliDatabase()
    return { success: true }
  } catch (error) {
    closeCliDatabase()
    const message = error instanceof Error ? error.message : 'Unknown error'
    spinner.fail(`Failed to unlink project: ${message}`)
    return { success: false, error: message }
  }
}
