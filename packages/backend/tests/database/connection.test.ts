import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { getDatabase, closeDatabase, resetDatabase, setDatabase } from '../../src/database/connection.js'
import { initSchema } from '../../src/database/schema.js'

describe('Database Connection', () => {
  beforeEach(() => {
    resetDatabase()
  })

  afterEach(() => {
    closeDatabase()
    resetDatabase()
  })

  it('should create in-memory database when inMemory option is true', () => {
    const db = getDatabase({ inMemory: true })
    expect(db).toBeDefined()
    expect(db.open).toBe(true)
  })

  it('should return the same instance on subsequent calls', () => {
    const db1 = getDatabase({ inMemory: true })
    const db2 = getDatabase({ inMemory: true })
    expect(db1).toBe(db2)
  })

  it('should close database correctly', () => {
    const db = getDatabase({ inMemory: true })
    expect(db.open).toBe(true)
    closeDatabase()
    expect(db.open).toBe(false)
  })

  it('should allow setting a custom database instance', () => {
    const customDb = new Database(':memory:')
    initSchema(customDb)

    setDatabase(customDb)
    const db = getDatabase()

    expect(db).toBe(customDb)
    customDb.close()
  })

  it('should reset database reference', () => {
    const db1 = getDatabase({ inMemory: true })
    closeDatabase()
    resetDatabase()
    const db2 = getDatabase({ inMemory: true })
    expect(db1).not.toBe(db2)
  })
})
