import type Database from 'better-sqlite3';
import { ProcessStatus } from '@ralphy/shared';
import { getDatabase } from '../index';
import { generateId } from '../../utils/id';
import { NotFoundError } from '../../utils/errors';

/**
 * Process data as stored in the database
 */
export interface Process {
  id: string;
  mission_id: string | null;
  type: string;
  command: string;
  cwd: string | null;
  env: Record<string, string> | null;
  pid: number | null;
  pgid: number | null;
  container_id: string | null;
  status: ProcessStatus;
  exit_code: number | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  ended_at: string | null;
  heartbeat_at: string | null;
}

/**
 * Raw process row from database (JSON fields are strings)
 */
interface ProcessRow {
  id: string;
  mission_id: string | null;
  type: string;
  command: string;
  cwd: string | null;
  env: string | null;
  pid: number | null;
  pgid: number | null;
  container_id: string | null;
  status: ProcessStatus;
  exit_code: number | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  ended_at: string | null;
  heartbeat_at: string | null;
}

/**
 * Data required to create a new process
 */
export interface CreateProcessData {
  type: string;
  command: string;
  cwd?: string;
  missionId?: string;
  env?: Record<string, string>;
}

/**
 * Convert a database row to a Process object (parse JSON fields)
 */
function rowToProcess(row: ProcessRow): Process {
  return {
    ...row,
    env: row.env ? JSON.parse(row.env) : null,
  };
}

/**
 * Repository for managing processes in the database
 */
export class ProcessRepository {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db || getDatabase();
  }

  /**
   * Create a new process record
   */
  create(data: CreateProcessData): Process {
    const id = generateId('proc');
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO processes (id, mission_id, type, command, cwd, env, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.missionId ?? null,
      data.type,
      data.command,
      data.cwd ?? null,
      data.env ? JSON.stringify(data.env) : null,
      ProcessStatus.QUEUED,
      now,
      now
    );

    return this.findById(id)!;
  }

  /**
   * Find a process by ID
   */
  findById(id: string): Process | null {
    const stmt = this.db.prepare(`
      SELECT id, mission_id, type, command, cwd, env, pid, pgid, container_id,
             status, exit_code, created_at, updated_at, started_at, ended_at, heartbeat_at
      FROM processes
      WHERE id = ?
    `);

    const row = stmt.get(id) as ProcessRow | undefined;
    return row ? rowToProcess(row) : null;
  }

  /**
   * Find all processes for a mission
   */
  findByMission(missionId: string): Process[] {
    const stmt = this.db.prepare(`
      SELECT id, mission_id, type, command, cwd, env, pid, pgid, container_id,
             status, exit_code, created_at, updated_at, started_at, ended_at, heartbeat_at
      FROM processes
      WHERE mission_id = ?
      ORDER BY created_at DESC
    `);

    const rows = stmt.all(missionId) as ProcessRow[];
    return rows.map(rowToProcess);
  }

  /**
   * Find all processes with status='running'
   */
  findRunning(): Process[] {
    const stmt = this.db.prepare(`
      SELECT id, mission_id, type, command, cwd, env, pid, pgid, container_id,
             status, exit_code, created_at, updated_at, started_at, ended_at, heartbeat_at
      FROM processes
      WHERE status = ?
      ORDER BY started_at ASC
    `);

    const rows = stmt.all(ProcessStatus.RUNNING) as ProcessRow[];
    return rows.map(rowToProcess);
  }

  /**
   * Find all processes by status
   */
  findByStatus(status: ProcessStatus): Process[] {
    const stmt = this.db.prepare(`
      SELECT id, mission_id, type, command, cwd, env, pid, pgid, container_id,
             status, exit_code, created_at, updated_at, started_at, ended_at, heartbeat_at
      FROM processes
      WHERE status = ?
      ORDER BY created_at DESC
    `);

    const rows = stmt.all(status) as ProcessRow[];
    return rows.map(rowToProcess);
  }

  /**
   * Update a process's status
   * - Sets started_at when transitioning to 'running'
   * - Sets ended_at when transitioning to terminal states (success, error, canceled)
   */
  updateStatus(id: string, status: ProcessStatus, exitCode?: number): Process {
    const existing = this.findById(id);
    if (!existing) {
      throw new NotFoundError('Process', id);
    }

    const now = new Date().toISOString();
    let startedAt = existing.started_at;
    let endedAt = existing.ended_at;

    // Set started_at when transitioning to running
    if (status === ProcessStatus.RUNNING && !startedAt) {
      startedAt = now;
    }

    // Set ended_at when transitioning to terminal states
    const terminalStatuses = [ProcessStatus.SUCCESS, ProcessStatus.ERROR, ProcessStatus.CANCELED];
    if (terminalStatuses.includes(status) && !endedAt) {
      endedAt = now;
    }

    const stmt = this.db.prepare(`
      UPDATE processes
      SET status = ?, exit_code = ?, started_at = ?, ended_at = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(status, exitCode ?? existing.exit_code, startedAt, endedAt, now, id);

    return this.findById(id)!;
  }

  /**
   * Update a process's PID and PGID (process group ID)
   */
  updatePid(id: string, pid: number, pgid?: number): Process {
    const existing = this.findById(id);
    if (!existing) {
      throw new NotFoundError('Process', id);
    }

    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE processes
      SET pid = ?, pgid = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(pid, pgid ?? pid, now, id);

    return this.findById(id)!;
  }

  /**
   * Update a process's container ID
   */
  updateContainerId(id: string, containerId: string): Process {
    const existing = this.findById(id);
    if (!existing) {
      throw new NotFoundError('Process', id);
    }

    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE processes
      SET container_id = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(containerId, now, id);

    return this.findById(id)!;
  }

  /**
   * Update a process's heartbeat timestamp
   */
  updateHeartbeat(id: string): Process {
    const existing = this.findById(id);
    if (!existing) {
      throw new NotFoundError('Process', id);
    }

    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE processes
      SET heartbeat_at = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(now, now, id);

    return this.findById(id)!;
  }

  /**
   * Find a process by container ID
   */
  findByContainerId(containerId: string): Process | null {
    const stmt = this.db.prepare(`
      SELECT id, mission_id, type, command, cwd, env, pid, pgid, container_id,
             status, exit_code, created_at, updated_at, started_at, ended_at, heartbeat_at
      FROM processes
      WHERE container_id = ?
    `);

    const row = stmt.get(containerId) as ProcessRow | undefined;
    return row ? rowToProcess(row) : null;
  }

  /**
   * Delete a process
   */
  delete(id: string): void {
    const existing = this.findById(id);
    if (!existing) {
      throw new NotFoundError('Process', id);
    }

    const stmt = this.db.prepare('DELETE FROM processes WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Delete all processes for a mission
   */
  deleteByMission(missionId: string): void {
    const stmt = this.db.prepare('DELETE FROM processes WHERE mission_id = ?');
    stmt.run(missionId);
  }
}
