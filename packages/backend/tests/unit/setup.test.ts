import { describe, it, expect, beforeEach } from 'vitest';
import { getTestDb, resetTestDb, createTestDb } from '../setup';

describe('Test Setup', () => {
  describe('getTestDb', () => {
    it('should return a database instance', () => {
      const db = getTestDb();
      expect(db).toBeDefined();
    });

    it('should return the same instance on subsequent calls', () => {
      const db1 = getTestDb();
      const db2 = getTestDb();
      expect(db1).toBe(db2);
    });
  });

  describe('createTestDb', () => {
    it('should create a new in-memory database', () => {
      const db = createTestDb();
      expect(db).toBeDefined();

      // Verify it's an in-memory database by checking it works
      const result = db.prepare('SELECT 1 as value').get() as { value: number };
      expect(result.value).toBe(1);

      db.close();
    });

    it('should have schema initialized', () => {
      const db = createTestDb();

      // Verify tables exist
      const tables = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all() as { name: string }[];

      const tableNames = tables.map((t) => t.name).sort();
      expect(tableNames).toContain('projects');
      expect(tableNames).toContain('missions');
      expect(tableNames).toContain('tasks');
      expect(tableNames).toContain('processes');
      expect(tableNames).toContain('mission_revisions');
      expect(tableNames).toContain('audit_log');

      db.close();
    });

    it('should have foreign keys enabled', () => {
      const db = createTestDb();
      const result = db.pragma('foreign_keys') as { foreign_keys: number }[];
      expect(result[0].foreign_keys).toBe(1);
      db.close();
    });
  });

  describe('resetTestDb', () => {
    it('should clear all data from tables', () => {
      const db = getTestDb();

      // Insert test data
      db.prepare(`
        INSERT INTO projects (id, name, path, created_at, updated_at)
        VALUES ('proj_test', 'Test Project', '/test/path', datetime('now'), datetime('now'))
      `).run();

      // Verify data exists
      let count = db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number };
      expect(count.count).toBe(1);

      // Reset
      resetTestDb();

      // Verify data is cleared
      count = db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number };
      expect(count.count).toBe(0);
    });

    it('should preserve the schema after reset', () => {
      const db = getTestDb();

      // Insert and reset
      db.prepare(`
        INSERT INTO projects (id, name, path, created_at, updated_at)
        VALUES ('proj_test', 'Test', '/test', datetime('now'), datetime('now'))
      `).run();

      resetTestDb();

      // Should still be able to insert after reset
      db.prepare(`
        INSERT INTO projects (id, name, path, created_at, updated_at)
        VALUES ('proj_new', 'New', '/new', datetime('now'), datetime('now'))
      `).run();

      const count = db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number };
      expect(count.count).toBe(1);
    });
  });

  describe('database isolation', () => {
    it('should have clean database at start of each test', () => {
      const db = getTestDb();

      // Insert data in this test
      db.prepare(`
        INSERT INTO projects (id, name, path, created_at, updated_at)
        VALUES ('proj_test1', 'Test1', '/test1', datetime('now'), datetime('now'))
      `).run();
    });

    it('should not see data from previous test', () => {
      const db = getTestDb();

      // Should be empty due to beforeEach reset
      const count = db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number };
      expect(count.count).toBe(0);
    });
  });
});
