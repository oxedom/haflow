import type Database from 'better-sqlite3'

const CREATE_PROJECTS_TABLE = `
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`

const CREATE_MISSIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS missions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    branch_name TEXT,
    draft_content TEXT NOT NULL,
    prd_content TEXT,
    prd_iterations INTEGER DEFAULT 0,
    tasks_iterations INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    container_id TEXT,
    worktree_path TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )
`

const CREATE_TASKS_TABLE = `
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    order_num INTEGER NOT NULL,
    status TEXT NOT NULL,
    agents TEXT,
    skills TEXT,
    steps_to_verify TEXT,
    passes INTEGER DEFAULT 0,
    output TEXT,
    FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE
  )
`

const CREATE_LOGS_TABLE = `
  CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    metadata TEXT,
    FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE
  )
`

const CREATE_INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_missions_project_id ON missions(project_id)',
  'CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status)',
  'CREATE INDEX IF NOT EXISTS idx_tasks_mission_id ON tasks(mission_id)',
  'CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)',
  'CREATE INDEX IF NOT EXISTS idx_logs_mission_id ON logs(mission_id)',
  'CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level)',
  'CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp)'
]

export function initSchema(db: Database.Database): void {
  db.pragma('foreign_keys = ON')

  db.exec(CREATE_PROJECTS_TABLE)
  db.exec(CREATE_MISSIONS_TABLE)
  db.exec(CREATE_TASKS_TABLE)
  db.exec(CREATE_LOGS_TABLE)

  for (const indexSql of CREATE_INDEXES) {
    db.exec(indexSql)
  }
}

export function dropAllTables(db: Database.Database): void {
  db.exec('DROP TABLE IF EXISTS logs')
  db.exec('DROP TABLE IF EXISTS tasks')
  db.exec('DROP TABLE IF EXISTS missions')
  db.exec('DROP TABLE IF EXISTS projects')
}
