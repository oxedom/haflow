import type Database from 'better-sqlite3';
import { getDatabase } from '../index';
import { generateId } from '../../utils/id';

/**
 * Audit log entry as stored in the database
 */
export interface AuditEntry {
  id: string;
  event: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Raw audit log row from database (details field is JSON string)
 */
interface AuditRow {
  id: string;
  event: string;
  entity_type: string | null;
  entity_id: string | null;
  details: string | null;
  created_at: string;
}

/**
 * Convert a database row to an AuditEntry object (parse JSON fields)
 */
function rowToAuditEntry(row: AuditRow): AuditEntry {
  return {
    ...row,
    details: row.details ? JSON.parse(row.details) : null,
  };
}

/**
 * Repository for managing audit log entries in the database
 */
export class AuditRepository {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db || getDatabase();
  }

  /**
   * Log an audit entry
   * @param event - The event name (e.g., 'mission.created', 'project.deleted')
   * @param entityType - The type of entity involved (e.g., 'mission', 'project')
   * @param entityId - The ID of the entity involved
   * @param details - Additional details about the event (stored as JSON)
   */
  log(
    event: string,
    entityType?: string | null,
    entityId?: string | null,
    details?: Record<string, unknown> | null
  ): AuditEntry {
    const id = generateId('audit');
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO audit_log (id, event, entity_type, entity_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      event,
      entityType ?? null,
      entityId ?? null,
      details ? JSON.stringify(details) : null,
      now
    );

    return this.findById(id)!;
  }

  /**
   * Find an audit entry by ID
   */
  findById(id: string): AuditEntry | null {
    const stmt = this.db.prepare(`
      SELECT id, event, entity_type, entity_id, details, created_at
      FROM audit_log
      WHERE id = ?
    `);

    const row = stmt.get(id) as AuditRow | undefined;
    return row ? rowToAuditEntry(row) : null;
  }

  /**
   * Find all audit entries for an entity
   * @param entityType - The type of entity (e.g., 'mission', 'project')
   * @param entityId - The ID of the entity
   */
  findByEntity(entityType: string, entityId: string): AuditEntry[] {
    const stmt = this.db.prepare(`
      SELECT id, event, entity_type, entity_id, details, created_at
      FROM audit_log
      WHERE entity_type = ? AND entity_id = ?
      ORDER BY created_at DESC
    `);

    const rows = stmt.all(entityType, entityId) as AuditRow[];
    return rows.map(rowToAuditEntry);
  }

  /**
   * Find all audit entries within a time range
   * @param start - ISO date string for the start of the range (inclusive)
   * @param end - ISO date string for the end of the range (inclusive)
   */
  findByTimeRange(start: string, end: string): AuditEntry[] {
    const stmt = this.db.prepare(`
      SELECT id, event, entity_type, entity_id, details, created_at
      FROM audit_log
      WHERE created_at >= ? AND created_at <= ?
      ORDER BY created_at DESC
    `);

    const rows = stmt.all(start, end) as AuditRow[];
    return rows.map(rowToAuditEntry);
  }

  /**
   * Find all audit entries by event type
   * @param event - The event name to filter by
   */
  findByEvent(event: string): AuditEntry[] {
    const stmt = this.db.prepare(`
      SELECT id, event, entity_type, entity_id, details, created_at
      FROM audit_log
      WHERE event = ?
      ORDER BY created_at DESC
    `);

    const rows = stmt.all(event) as AuditRow[];
    return rows.map(rowToAuditEntry);
  }

  /**
   * Find all audit entries (with optional limit)
   * @param limit - Maximum number of entries to return (default: 100)
   */
  findAll(limit: number = 100): AuditEntry[] {
    const stmt = this.db.prepare(`
      SELECT id, event, entity_type, entity_id, details, created_at
      FROM audit_log
      ORDER BY created_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as AuditRow[];
    return rows.map(rowToAuditEntry);
  }

  /**
   * Delete all audit entries older than the given date
   * @param olderThan - ISO date string; entries created before this date will be deleted
   */
  deleteOlderThan(olderThan: string): number {
    const stmt = this.db.prepare(`
      DELETE FROM audit_log
      WHERE created_at < ?
    `);

    const result = stmt.run(olderThan);
    return result.changes;
  }
}
