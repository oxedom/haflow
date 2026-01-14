import Database from 'better-sqlite3'
import { initSchema } from './schema.js'
import { join } from 'path'
import { homedir } from 'os'
import { mkdirSync, existsSync } from 'fs'

let db: Database.Database | null = null

export interface DatabaseOptions {
  path?: string
  inMemory?: boolean
}

export function getDatabase(options?: DatabaseOptions): Database.Database {
  if (db) {
    return db
  }

  let dbPath: string

  if (options?.inMemory) {
    dbPath = ':memory:'
  } else if (options?.path) {
    dbPath = options.path
  } else {
    const ralphyDir = join(homedir(), '.ralphy')
    if (!existsSync(ralphyDir)) {
      mkdirSync(ralphyDir, { recursive: true })
    }
    dbPath = join(ralphyDir, 'ralphy.sqlite')
  }

  db = new Database(dbPath)
  initSchema(db)

  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

export function setDatabase(database: Database.Database): void {
  db = database
}

export function resetDatabase(): void {
  db = null
}
