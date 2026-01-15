import Database from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

let db: Database.Database | null = null;

/**
 * Get the Ralphy home directory path.
 * Defaults to ~/.ralphy, can be overridden with RALPHY_HOME env var.
 */
function getRalphyHome(): string {
  return process.env.RALPHY_HOME || path.join(os.homedir(), '.ralphy');
}

/**
 * Get the database file path.
 */
export function getDatabasePath(): string {
  return path.join(getRalphyHome(), 'ralphy.sqlite');
}

/**
 * Get the singleton database instance.
 * Throws if database has not been initialized.
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Initialize the database connection.
 * Creates the Ralphy home directory if it doesn't exist.
 * Configures SQLite with optimal settings for the application.
 */
export function initializeDatabase(dbPath?: string): Database.Database {
  if (db) {
    return db;
  }

  const databasePath = dbPath || getDatabasePath();

  // Ensure the directory exists
  const dir = path.dirname(databasePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Create database connection
  db = new Database(databasePath);

  // Configure PRAGMA statements for optimal performance and safety
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  return db;
}

/**
 * Close the database connection.
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Reset the database singleton (useful for testing).
 */
export function resetDatabaseInstance(): void {
  db = null;
}
