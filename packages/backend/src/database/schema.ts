import type Database from 'better-sqlite3';

/**
 * SQL DDL statements to create all database tables and indexes.
 * Uses CREATE TABLE IF NOT EXISTS for idempotency.
 */
export const SCHEMA_SQL = `
-- Projects table: Registry of linked repositories
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  is_active INTEGER DEFAULT 1,
  config TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Missions table: AI-driven feature development loops
CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  feature_name TEXT NOT NULL,
  description TEXT,
  state TEXT NOT NULL DEFAULT 'draft',
  worktree_path TEXT,
  prd_path TEXT,
  tasks_path TEXT,
  prd_iterations INTEGER DEFAULT 0,
  tasks_iterations INTEGER DEFAULT 0,
  result TEXT,
  failure_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  ended_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Tasks table: Individual work items within a mission
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  order_num INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  agents TEXT,
  skills TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE
);

-- Processes table: Spawned subprocesses and Docker containers
CREATE TABLE IF NOT EXISTS processes (
  id TEXT PRIMARY KEY,
  mission_id TEXT,
  type TEXT NOT NULL,
  command TEXT NOT NULL,
  cwd TEXT,
  env TEXT,
  pid INTEGER,
  pgid INTEGER,
  container_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  exit_code INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  ended_at TEXT,
  heartbeat_at TEXT,
  FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE SET NULL
);

-- Mission revisions table: Track PRD and task revision history
CREATE TABLE IF NOT EXISTS mission_revisions (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  type TEXT NOT NULL,
  version INTEGER NOT NULL,
  content TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE,
  UNIQUE (mission_id, type, version)
);

-- Audit log table: Record of significant events
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  event TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(path);
CREATE INDEX IF NOT EXISTS idx_projects_is_active ON projects(is_active);

CREATE INDEX IF NOT EXISTS idx_missions_project ON missions(project_id);
CREATE INDEX IF NOT EXISTS idx_missions_state ON missions(state);
CREATE INDEX IF NOT EXISTS idx_missions_created_at ON missions(created_at);

CREATE INDEX IF NOT EXISTS idx_tasks_mission ON tasks(mission_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_order ON tasks(mission_id, order_num);

CREATE INDEX IF NOT EXISTS idx_processes_mission ON processes(mission_id);
CREATE INDEX IF NOT EXISTS idx_processes_status ON processes(status);
CREATE INDEX IF NOT EXISTS idx_processes_container ON processes(container_id);

CREATE INDEX IF NOT EXISTS idx_revisions_mission ON mission_revisions(mission_id);
CREATE INDEX IF NOT EXISTS idx_revisions_type ON mission_revisions(mission_id, type);

CREATE INDEX IF NOT EXISTS idx_audit_event ON audit_log(event);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at);
`;

/**
 * Initialize the database schema.
 * This function is idempotent and can be called multiple times safely.
 */
export function initSchema(db: Database.Database): void {
  db.exec(SCHEMA_SQL);
}
