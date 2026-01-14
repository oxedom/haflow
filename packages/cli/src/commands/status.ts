import { existsSync, readFileSync } from 'fs'
import chalk from 'chalk'
import { RALPHY_HOME, SERVER_PID_PATH } from '../lib/paths.js'
import { configExists, loadGlobalConfig } from '../lib/config.js'
import { getCliDatabase, closeCliDatabase, databaseExists } from '../lib/database.js'

export interface StatusOptions {
  json?: boolean
}

interface ProjectWithMissionCount {
  id: string
  name: string
  path: string
  is_active: number
  created_at: string
  updated_at: string
  mission_count: number
}

export interface StatusInfo {
  initialized: boolean
  ralphyHome: string | null
  server: {
    running: boolean
    pid: number | null
    url: string | null
  }
  projects: Array<{
    name: string
    path: string
    missionCount: number
  }>
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function getServerInfo(): { running: boolean; pid: number | null; url: string | null } {
  if (!existsSync(SERVER_PID_PATH)) {
    return { running: false, pid: null, url: null }
  }

  try {
    const pid = parseInt(readFileSync(SERVER_PID_PATH, 'utf-8').trim(), 10)
    if (isNaN(pid) || !isProcessRunning(pid)) {
      return { running: false, pid: null, url: null }
    }

    const config = loadGlobalConfig()
    const host = config?.server.host || '127.0.0.1'
    const port = config?.server.port || 3847
    const url = `http://${host}:${port}`

    return { running: true, pid, url }
  } catch {
    return { running: false, pid: null, url: null }
  }
}

export async function statusCommand(options: StatusOptions): Promise<StatusInfo> {
  const isInitialized = existsSync(RALPHY_HOME) && configExists() && databaseExists()

  const serverInfo = getServerInfo()
  const projects: StatusInfo['projects'] = []

  if (isInitialized) {
    const db = getCliDatabase()
    try {
      const rows = db.prepare(`
        SELECT
          p.id,
          p.name,
          p.path,
          p.is_active,
          p.created_at,
          p.updated_at,
          COUNT(m.id) as mission_count
        FROM projects p
        LEFT JOIN missions m ON p.id = m.project_id
        WHERE p.is_active = 1
        GROUP BY p.id
        ORDER BY p.name
      `).all() as ProjectWithMissionCount[]

      for (const row of rows) {
        projects.push({
          name: row.name,
          path: row.path,
          missionCount: row.mission_count
        })
      }
    } finally {
      closeCliDatabase()
    }
  }

  const status: StatusInfo = {
    initialized: isInitialized,
    ralphyHome: isInitialized ? RALPHY_HOME : null,
    server: serverInfo,
    projects
  }

  if (options.json) {
    console.log(JSON.stringify(status, null, 2))
    return status
  }

  // Pretty print
  console.log('')
  console.log(chalk.bold('Ralphy Status'))
  console.log(chalk.dim('─────────────'))

  if (isInitialized) {
    console.log(`Initialized: ${chalk.green('✓')} ${chalk.cyan(RALPHY_HOME)}`)
  } else {
    console.log(`Initialized: ${chalk.red('✗')} ${chalk.dim('Not initialized')}`)
  }

  if (serverInfo.running) {
    console.log(`Server:      ${chalk.green('✓')} Running at ${chalk.cyan(serverInfo.url)}`)
  } else {
    console.log(`Server:      ${chalk.red('✗')} ${chalk.dim('Not running')}`)
  }

  if (projects.length > 0) {
    console.log('')
    console.log(chalk.bold(`Linked Projects (${projects.length})`))
    console.log(chalk.dim('───────────────────'))

    const maxNameLen = Math.max(...projects.map(p => p.name.length), 10)

    for (const project of projects) {
      const name = project.name.padEnd(maxNameLen)
      const missions = project.missionCount === 1 ? '1 mission' : `${project.missionCount} missions`
      console.log(`  ${chalk.cyan(name)}  ${chalk.dim(project.path)}  (${missions})`)
    }
  } else if (isInitialized) {
    console.log('')
    console.log(chalk.dim('No linked projects'))
    console.log(chalk.dim('  cd <your-project>'))
    console.log(chalk.dim('  ralphy link'))
  }

  console.log('')

  return status
}
