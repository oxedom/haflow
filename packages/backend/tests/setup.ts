import { vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { initSchema } from '../src/database/schema.js'

let testDb: Database.Database

export function getTestDatabase(): Database.Database {
  return testDb
}

beforeEach(() => {
  testDb = new Database(':memory:')
  initSchema(testDb)
})

afterEach(() => {
  testDb.close()
})

export { testDb }
