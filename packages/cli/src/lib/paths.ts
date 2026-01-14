import { join } from 'path'
import { homedir } from 'os'

export const RALPHY_HOME = process.env.RALPHY_HOME || join(homedir(), '.ralphy')
export const GLOBAL_CONFIG_PATH = join(RALPHY_HOME, 'config.json')
export const GLOBAL_DB_PATH = join(RALPHY_HOME, 'ralphy.sqlite')
export const SERVER_PID_PATH = join(RALPHY_HOME, 'server.pid')
export const LOGS_DIR = join(RALPHY_HOME, 'logs')
export const PROJECT_DIR_NAME = '.ralphy'

export function getProjectRalphyDir(projectPath: string): string {
  return join(projectPath, PROJECT_DIR_NAME)
}

export function getMissionDir(projectPath: string, missionName: string): string {
  return join(getProjectRalphyDir(projectPath), 'missions', missionName)
}
