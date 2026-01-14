import Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { GLOBAL_DB_PATH, RALPHY_HOME } from './paths.js'
import { initSchema } from '@ralphy/backend'

let db: Database.Database | null = null

export function getCliDatabase(): Database.Database {
  if (db) {
    return db
  }

  if (!existsSync(RALPHY_HOME)) {
    mkdirSync(RALPHY_HOME, { recursive: true })
  }

  const dbDir = dirname(GLOBAL_DB_PATH)
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }

  db = new Database(GLOBAL_DB_PATH)
  initSchema(db)

  return db
}

export function closeCliDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

export function resetCliDatabase(): void {
  db = null
}

export function setCliDatabase(database: Database.Database): void {
  db = database
}

export function databaseExists(): boolean {
  return existsSync(GLOBAL_DB_PATH)
}
