import { readFileSync, writeFileSync, existsSync } from 'fs'
import { GLOBAL_CONFIG_PATH } from './paths.js'

export interface ServerConfig {
  port: number
  host: string
}

export interface DatabaseConfig {
  path: string
}

export interface LoggingConfig {
  level: string
  file: string
}

export interface GlobalConfig {
  version: string
  server: ServerConfig
  database: DatabaseConfig
  logging: LoggingConfig
}

export function getDefaultConfig(): GlobalConfig {
  return {
    version: '0.0.1',
    server: {
      port: 3847,
      host: '127.0.0.1'
    },
    database: {
      path: '~/.ralphy/ralphy.sqlite'
    },
    logging: {
      level: 'info',
      file: '~/.ralphy/logs/server.log'
    }
  }
}

export function loadGlobalConfig(): GlobalConfig | null {
  if (!existsSync(GLOBAL_CONFIG_PATH)) {
    return null
  }

  try {
    const content = readFileSync(GLOBAL_CONFIG_PATH, 'utf-8')
    return JSON.parse(content) as GlobalConfig
  } catch {
    return null
  }
}

export function saveGlobalConfig(config: GlobalConfig): void {
  writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify(config, null, 2))
}

export function configExists(): boolean {
  return existsSync(GLOBAL_CONFIG_PATH)
}
