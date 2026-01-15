import type Database from 'better-sqlite3';
import { MissionState, isValidTransition } from '@ralphy/shared';
import { getDatabase } from '../index';
import { generateId } from '../../utils/id';
import { NotFoundError, InvalidStateTransitionError } from '../../utils/errors';

/**
 * Mission data as stored in the database
 */
export interface Mission {
  id: string;
  project_id: string;
  feature_name: string;
  description: string | null;
  state: MissionState;
  worktree_path: string | null;
  prd_path: string | null;
  tasks_path: string | null;
  prd_iterations: number;
  tasks_iterations: number;
  result: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  ended_at: string | null;
}

/**
 * Data required to create a new mission
 */
export interface CreateMissionData {
  project_id: string;
  feature_name: string;
  description?: string;
}

/**
 * Data that can be updated on a mission
 */
export interface UpdateMissionData {
  feature_name?: string;
  description?: string;
  worktree_path?: string;
  prd_path?: string;
  tasks_path?: string;
  prd_iterations?: number;
  tasks_iterations?: number;
  result?: string;
  failure_reason?: string;
  started_at?: string;
  ended_at?: string;
}

/**
 * Repository for managing missions in the database
 */
export class MissionRepository {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db || getDatabase();
  }

  /**
   * Create a new mission
   * Initializes with state='draft'
   */
  create(data: CreateMissionData): Mission {
    const id = generateId('mission');
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO missions (id, project_id, feature_name, description, state, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.project_id,
      data.feature_name,
      data.description || null,
      MissionState.DRAFT,
      now,
      now
    );

    return this.findById(id)!;
  }

  /**
   * Find a mission by ID
   */
  findById(id: string): Mission | null {
    const stmt = this.db.prepare(`
      SELECT id, project_id, feature_name, description, state, worktree_path,
             prd_path, tasks_path, prd_iterations, tasks_iterations, result,
             failure_reason, created_at, updated_at, started_at, ended_at
      FROM missions
      WHERE id = ?
    `);

    const row = stmt.get(id) as Mission | undefined;
    return row || null;
  }

  /**
   * Find all missions for a specific project
   */
  findByProject(projectId: string): Mission[] {
    const stmt = this.db.prepare(`
      SELECT id, project_id, feature_name, description, state, worktree_path,
             prd_path, tasks_path, prd_iterations, tasks_iterations, result,
             failure_reason, created_at, updated_at, started_at, ended_at
      FROM missions
      WHERE project_id = ?
      ORDER BY created_at DESC
    `);

    return stmt.all(projectId) as Mission[];
  }

  /**
   * Find missions in any of the specified states
   */
  findByStates(states: MissionState[]): Mission[] {
    if (states.length === 0) {
      return [];
    }

    const placeholders = states.map(() => '?').join(', ');
    const stmt = this.db.prepare(`
      SELECT id, project_id, feature_name, description, state, worktree_path,
             prd_path, tasks_path, prd_iterations, tasks_iterations, result,
             failure_reason, created_at, updated_at, started_at, ended_at
      FROM missions
      WHERE state IN (${placeholders})
      ORDER BY created_at DESC
    `);

    return stmt.all(...states) as Mission[];
  }

  /**
   * Get all missions
   */
  findAll(): Mission[] {
    const stmt = this.db.prepare(`
      SELECT id, project_id, feature_name, description, state, worktree_path,
             prd_path, tasks_path, prd_iterations, tasks_iterations, result,
             failure_reason, created_at, updated_at, started_at, ended_at
      FROM missions
      ORDER BY created_at DESC
    `);

    return stmt.all() as Mission[];
  }

  /**
   * Update a mission's state with validation
   * Throws InvalidStateTransitionError if the transition is not allowed
   */
  updateState(id: string, newState: MissionState): Mission {
    const existing = this.findById(id);
    if (!existing) {
      throw new NotFoundError('Mission', id);
    }

    const currentState = existing.state;

    // Validate the state transition
    if (!isValidTransition(currentState, newState)) {
      throw new InvalidStateTransitionError(currentState, newState);
    }

    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE missions
      SET state = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(newState, now, id);

    return this.findById(id)!;
  }

  /**
   * Update a mission's data (not including state)
   */
  update(id: string, data: UpdateMissionData): Mission {
    const existing = this.findById(id);
    if (!existing) {
      throw new NotFoundError('Mission', id);
    }

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (data.feature_name !== undefined) {
      updates.push('feature_name = ?');
      values.push(data.feature_name);
    }

    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }

    if (data.worktree_path !== undefined) {
      updates.push('worktree_path = ?');
      values.push(data.worktree_path);
    }

    if (data.prd_path !== undefined) {
      updates.push('prd_path = ?');
      values.push(data.prd_path);
    }

    if (data.tasks_path !== undefined) {
      updates.push('tasks_path = ?');
      values.push(data.tasks_path);
    }

    if (data.prd_iterations !== undefined) {
      updates.push('prd_iterations = ?');
      values.push(data.prd_iterations);
    }

    if (data.tasks_iterations !== undefined) {
      updates.push('tasks_iterations = ?');
      values.push(data.tasks_iterations);
    }

    if (data.result !== undefined) {
      updates.push('result = ?');
      values.push(data.result);
    }

    if (data.failure_reason !== undefined) {
      updates.push('failure_reason = ?');
      values.push(data.failure_reason);
    }

    if (data.started_at !== undefined) {
      updates.push('started_at = ?');
      values.push(data.started_at);
    }

    if (data.ended_at !== undefined) {
      updates.push('ended_at = ?');
      values.push(data.ended_at);
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE missions
      SET ${updates.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);

    return this.findById(id)!;
  }

  /**
   * Delete a mission
   */
  delete(id: string): void {
    const existing = this.findById(id);
    if (!existing) {
      throw new NotFoundError('Mission', id);
    }

    const stmt = this.db.prepare('DELETE FROM missions WHERE id = ?');
    stmt.run(id);
  }
}
