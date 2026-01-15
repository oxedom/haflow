import type Database from 'better-sqlite3';
import { TaskStatus } from '@ralphy/shared';
import { getDatabase } from '../index';
import { generateId } from '../../utils/id';
import { NotFoundError } from '../../utils/errors';

/**
 * Task data as stored in the database
 */
export interface Task {
  id: string;
  mission_id: string;
  name: string;
  description: string | null;
  order_num: number;
  status: TaskStatus;
  agents: string[] | null;
  skills: string[] | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

/**
 * Raw task row from database (JSON fields are strings)
 */
interface TaskRow {
  id: string;
  mission_id: string;
  name: string;
  description: string | null;
  order_num: number;
  status: TaskStatus;
  agents: string | null;
  skills: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

/**
 * Data required to create a new task
 */
export interface CreateTaskData {
  name: string;
  description?: string;
  agents?: string[];
  skills?: string[];
}

/**
 * Data that can be updated on a task
 */
export interface UpdateTaskData {
  name?: string;
  description?: string;
  agents?: string[];
  skills?: string[];
}

/**
 * Terminal task statuses that should set completed_at
 */
const TERMINAL_STATUSES: TaskStatus[] = [
  TaskStatus.COMPLETED,
  TaskStatus.FAILED,
  TaskStatus.SKIPPED,
];

/**
 * Convert a database row to a Task object (parse JSON fields)
 */
function rowToTask(row: TaskRow): Task {
  return {
    ...row,
    agents: row.agents ? JSON.parse(row.agents) : null,
    skills: row.skills ? JSON.parse(row.skills) : null,
  };
}

/**
 * Repository for managing tasks in the database
 */
export class TaskRepository {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db || getDatabase();
  }

  /**
   * Create multiple tasks for a mission
   * order_num is set from the array index (0-based)
   */
  createMany(missionId: string, tasks: CreateTaskData[]): Task[] {
    const now = new Date().toISOString();
    const createdTasks: Task[] = [];

    const stmt = this.db.prepare(`
      INSERT INTO tasks (id, mission_id, name, description, order_num, status, agents, skills, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Use a transaction for batch insert
    const insertMany = this.db.transaction((items: CreateTaskData[]) => {
      for (let i = 0; i < items.length; i++) {
        const task = items[i]!;
        const id = generateId('task');

        stmt.run(
          id,
          missionId,
          task.name,
          task.description ?? null,
          i, // order_num from array index
          TaskStatus.PENDING,
          task.agents ? JSON.stringify(task.agents) : null,
          task.skills ? JSON.stringify(task.skills) : null,
          now,
          now
        );

        // Fetch the created task
        const created = this.findById(id);
        if (created) {
          createdTasks.push(created);
        }
      }
    });

    insertMany(tasks);

    return createdTasks;
  }

  /**
   * Create a single task for a mission
   */
  create(missionId: string, data: CreateTaskData, orderNum: number): Task {
    const id = generateId('task');
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO tasks (id, mission_id, name, description, order_num, status, agents, skills, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      missionId,
      data.name,
      data.description || null,
      orderNum,
      TaskStatus.PENDING,
      data.agents ? JSON.stringify(data.agents) : null,
      data.skills ? JSON.stringify(data.skills) : null,
      now,
      now
    );

    return this.findById(id)!;
  }

  /**
   * Find a task by ID
   */
  findById(id: string): Task | null {
    const stmt = this.db.prepare(`
      SELECT id, mission_id, name, description, order_num, status, agents, skills,
             created_at, updated_at, started_at, completed_at
      FROM tasks
      WHERE id = ?
    `);

    const row = stmt.get(id) as TaskRow | undefined;
    return row ? rowToTask(row) : null;
  }

  /**
   * Find all tasks for a mission, ordered by order_num ASC
   */
  findByMission(missionId: string): Task[] {
    const stmt = this.db.prepare(`
      SELECT id, mission_id, name, description, order_num, status, agents, skills,
             created_at, updated_at, started_at, completed_at
      FROM tasks
      WHERE mission_id = ?
      ORDER BY order_num ASC
    `);

    const rows = stmt.all(missionId) as TaskRow[];
    return rows.map(rowToTask);
  }

  /**
   * Find all tasks with a specific status
   */
  findByStatus(status: TaskStatus): Task[] {
    const stmt = this.db.prepare(`
      SELECT id, mission_id, name, description, order_num, status, agents, skills,
             created_at, updated_at, started_at, completed_at
      FROM tasks
      WHERE status = ?
      ORDER BY created_at ASC
    `);

    const rows = stmt.all(status) as TaskRow[];
    return rows.map(rowToTask);
  }

  /**
   * Update a task's status
   * - Sets started_at when transitioning to 'in_progress'
   * - Sets completed_at when transitioning to terminal states (completed, failed, skipped)
   */
  updateStatus(id: string, status: TaskStatus): Task {
    const existing = this.findById(id);
    if (!existing) {
      throw new NotFoundError('Task', id);
    }

    const now = new Date().toISOString();
    let startedAt = existing.started_at;
    let completedAt = existing.completed_at;

    // Set started_at when transitioning to in_progress
    if (status === TaskStatus.IN_PROGRESS && !startedAt) {
      startedAt = now;
    }

    // Set completed_at when transitioning to terminal states
    if (TERMINAL_STATUSES.includes(status) && !completedAt) {
      completedAt = now;
    }

    const stmt = this.db.prepare(`
      UPDATE tasks
      SET status = ?, started_at = ?, completed_at = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(status, startedAt, completedAt, now, id);

    return this.findById(id)!;
  }

  /**
   * Update a task's data (not including status)
   */
  update(id: string, data: UpdateTaskData): Task {
    const existing = this.findById(id);
    if (!existing) {
      throw new NotFoundError('Task', id);
    }

    const updates: string[] = [];
    const values: (string | null)[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }

    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }

    if (data.agents !== undefined) {
      updates.push('agents = ?');
      values.push(JSON.stringify(data.agents));
    }

    if (data.skills !== undefined) {
      updates.push('skills = ?');
      values.push(JSON.stringify(data.skills));
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE tasks
      SET ${updates.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);

    return this.findById(id)!;
  }

  /**
   * Delete a task
   */
  delete(id: string): void {
    const existing = this.findById(id);
    if (!existing) {
      throw new NotFoundError('Task', id);
    }

    const stmt = this.db.prepare('DELETE FROM tasks WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Delete all tasks for a mission
   */
  deleteByMission(missionId: string): void {
    const stmt = this.db.prepare('DELETE FROM tasks WHERE mission_id = ?');
    stmt.run(missionId);
  }

  /**
   * Get the next task to execute for a mission (first pending task)
   */
  getNextPending(missionId: string): Task | null {
    const stmt = this.db.prepare(`
      SELECT id, mission_id, name, description, order_num, status, agents, skills,
             created_at, updated_at, started_at, completed_at
      FROM tasks
      WHERE mission_id = ? AND status = ?
      ORDER BY order_num ASC
      LIMIT 1
    `);

    const row = stmt.get(missionId, TaskStatus.PENDING) as TaskRow | undefined;
    return row ? rowToTask(row) : null;
  }
}
