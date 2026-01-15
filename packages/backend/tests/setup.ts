import Database from 'better-sqlite3';
import { vi, beforeEach, afterEach, afterAll } from 'vitest';
import { initSchema } from '../src/database/schema';

// Module-level test database instance
let testDb: Database.Database | null = null;

/**
 * Get the test database instance.
 * Creates a new in-memory database if one doesn't exist.
 */
export function getTestDb(): Database.Database {
  if (!testDb) {
    testDb = createTestDb();
  }
  return testDb;
}

/**
 * Create a fresh in-memory SQLite database with schema initialized.
 */
export function createTestDb(): Database.Database {
  const db = new Database(':memory:');

  // Configure PRAGMA statements for consistency with production
  db.pragma('foreign_keys = ON');

  // Initialize schema
  initSchema(db);

  return db;
}

/**
 * Reset the test database by clearing all tables.
 * This preserves the schema but removes all data.
 */
export function resetTestDb(): void {
  if (!testDb) {
    testDb = createTestDb();
    return;
  }

  // Clear all tables in reverse dependency order to avoid foreign key violations
  const tables = [
    'audit_log',
    'mission_revisions',
    'processes',
    'tasks',
    'missions',
    'projects'
  ];

  for (const table of tables) {
    testDb.prepare(`DELETE FROM ${table}`).run();
  }
}

/**
 * Close the test database connection.
 */
export function closeTestDb(): void {
  if (testDb) {
    testDb.close();
    testDb = null;
  }
}

// Vitest hooks - called automatically via setupFiles in vitest.config.ts

// Reset database before each test for isolation
beforeEach(() => {
  resetTestDb();
});

// Clean up after each test
afterEach(() => {
  vi.restoreAllMocks();
});

// Close database after all tests complete
afterAll(() => {
  closeTestDb();
});
