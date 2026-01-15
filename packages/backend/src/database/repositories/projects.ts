import type Database from 'better-sqlite3';
import { MissionState } from '@ralphy/shared';
import { getDatabase } from '../index';
import { generateId } from '../../utils/id';
import { NotFoundError } from '../../utils/errors';

/**
 * Project data as stored in the database
 */
export interface Project {
  id: string;
  name: string;
  path: string;
  is_active: number;
  config: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Project with computed mission count for list views
 */
export interface ProjectWithMissionsCount extends Project {
  missionsCount: number;
}

/**
 * Data required to create a new project
 */
export interface CreateProjectData {
  name: string;
  path: string;
  config?: Record<string, unknown>;
}

/**
 * Data that can be updated on a project
 */
export interface UpdateProjectData {
  name?: string;
  config?: Record<string, unknown>;
  is_active?: boolean;
}

// Terminal states - missions in these states are considered complete
const TERMINAL_STATES = [MissionState.COMPLETED_SUCCESS, MissionState.COMPLETED_FAILED];

/**
 * Repository for managing projects in the database
 */
export class ProjectRepository {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db || getDatabase();
  }

  /**
   * Create a new project
   */
  create(data: CreateProjectData): Project {
    const id = generateId('proj');
    const now = new Date().toISOString();
    const configJson = data.config ? JSON.stringify(data.config) : null;

    const stmt = this.db.prepare(`
      INSERT INTO projects (id, name, path, config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, data.name, data.path, configJson, now, now);

    return this.findById(id)!;
  }

  /**
   * Find a project by ID
   */
  findById(id: string): Project | null {
    const stmt = this.db.prepare(`
      SELECT id, name, path, is_active, config, created_at, updated_at
      FROM projects
      WHERE id = ?
    `);

    return stmt.get(id) as Project | null;
  }

  /**
   * Find a project by its file system path
   */
  findByPath(path: string): Project | null {
    const stmt = this.db.prepare(`
      SELECT id, name, path, is_active, config, created_at, updated_at
      FROM projects
      WHERE path = ?
    `);

    return stmt.get(path) as Project | null;
  }

  /**
   * Get all projects with their mission counts
   */
  findAll(): ProjectWithMissionsCount[] {
    const stmt = this.db.prepare(`
      SELECT
        p.id, p.name, p.path, p.is_active, p.config, p.created_at, p.updated_at,
        COUNT(m.id) as missionsCount
      FROM projects p
      LEFT JOIN missions m ON m.project_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);

    return stmt.all() as ProjectWithMissionsCount[];
  }

  /**
   * Update a project
   */
  update(id: string, data: UpdateProjectData): Project {
    const existing = this.findById(id);
    if (!existing) {
      throw new NotFoundError('Project', id);
    }

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }

    if (data.config !== undefined) {
      updates.push('config = ?');
      values.push(JSON.stringify(data.config));
    }

    if (data.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(data.is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE projects
      SET ${updates.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);

    return this.findById(id)!;
  }

  /**
   * Delete a project
   * Throws an error if the project has active (non-terminal) missions
   */
  delete(id: string): void {
    const existing = this.findById(id);
    if (!existing) {
      throw new NotFoundError('Project', id);
    }

    // Check for active missions (missions not in terminal states)
    const placeholders = TERMINAL_STATES.map(() => '?').join(', ');
    const activeMissionsStmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM missions
      WHERE project_id = ? AND state NOT IN (${placeholders})
    `);

    const result = activeMissionsStmt.get(id, ...TERMINAL_STATES) as { count: number };

    if (result.count > 0) {
      throw new Error(
        `Cannot delete project '${id}': has ${result.count} active mission(s). ` +
        `Complete or cancel all missions before deleting the project.`
      );
    }

    const stmt = this.db.prepare('DELETE FROM projects WHERE id = ?');
    stmt.run(id);
  }
}
