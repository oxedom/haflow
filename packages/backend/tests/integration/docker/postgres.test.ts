import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { dockerProvider } from '../../../src/services/docker.js';
import { getTestDir } from '../../setup.js';

/**
 * Integration tests for dockerProvider using database-related containers.
 * These tests verify the docker service can:
 * - Start containers with environment variables
 * - Mount volumes correctly
 * - Execute database CLI tools
 * - Capture logs and exit codes
 *
 * Note: The dockerProvider runs containers as the current user for security,
 * which limits what can be done with containers requiring root (like starting
 * a full postgres server). These tests focus on CLI tool execution.
 */
describe('dockerProvider with database containers', () => {
  let dockerAvailable: boolean;
  const createdContainers: string[] = [];
  const skipInCi = Boolean(process.env.CI);

  beforeAll(async () => {
    dockerAvailable = await dockerProvider.isAvailable();
    if (!dockerAvailable) {
      console.warn('Docker not available - skipping database integration tests');
    }
  });

  afterEach(async () => {
    // Cleanup containers created during tests
    for (const id of createdContainers) {
      await dockerProvider.remove(id).catch(() => {});
    }
    createdContainers.length = 0;
  });

  describe('postgres client tools', () => {
    it.skipIf(skipInCi)('pg_dump --version works without server', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'pg-version-artifacts');
      await mkdir(artifactsPath, { recursive: true });

      // Test that postgres client tools are available and work
      const containerId = await dockerProvider.start({
        missionId: 'm-pg-version',
        runId: 'r-pg-version',
        stepId: 'pg-version-step',
        image: 'postgres:16-alpine',
        artifactsPath,
        command: ['pg_dump', '--version'],
      });

      createdContainers.push(containerId);

      // Wait for container to complete
      let status = await dockerProvider.getStatus(containerId);
      const maxWait = 30;
      for (let i = 0; i < maxWait && status.state === 'running'; i++) {
        await new Promise(r => setTimeout(r, 1000));
        status = await dockerProvider.getStatus(containerId);
      }

      expect(status.state).toBe('exited');
      expect(status.exitCode).toBe(0);

      const logs = await dockerProvider.getLogTail(containerId);
      expect(logs).toContain('pg_dump');
      expect(logs).toMatch(/PostgreSQL/i);
    }, 60000);

    it.skipIf(skipInCi)('psql --version works without server', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'psql-version-artifacts');
      await mkdir(artifactsPath, { recursive: true });

      const containerId = await dockerProvider.start({
        missionId: 'm-psql-version',
        runId: 'r-psql-version',
        stepId: 'psql-version-step',
        image: 'postgres:16-alpine',
        artifactsPath,
        command: ['psql', '--version'],
      });

      createdContainers.push(containerId);

      // Wait for container to complete
      let status = await dockerProvider.getStatus(containerId);
      const maxWait = 30;
      for (let i = 0; i < maxWait && status.state === 'running'; i++) {
        await new Promise(r => setTimeout(r, 1000));
        status = await dockerProvider.getStatus(containerId);
      }

      expect(status.state).toBe('exited');
      expect(status.exitCode).toBe(0);

      const logs = await dockerProvider.getLogTail(containerId);
      expect(logs).toContain('psql');
      expect(logs).toMatch(/PostgreSQL/i);
    }, 60000);

    it.skipIf(skipInCi)('pg_isready returns connection error without server', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'pg-isready-artifacts');
      await mkdir(artifactsPath, { recursive: true });

      // pg_isready should fail when no server is running
      const containerId = await dockerProvider.start({
        missionId: 'm-pg-isready',
        runId: 'r-pg-isready',
        stepId: 'pg-isready-step',
        image: 'postgres:16-alpine',
        artifactsPath,
        command: ['pg_isready', '-h', 'localhost'],
      });

      createdContainers.push(containerId);

      // Wait for container to complete
      let status = await dockerProvider.getStatus(containerId);
      const maxWait = 30;
      for (let i = 0; i < maxWait && status.state === 'running'; i++) {
        await new Promise(r => setTimeout(r, 1000));
        status = await dockerProvider.getStatus(containerId);
      }

      expect(status.state).toBe('exited');
      // Should fail because no server is running
      expect(status.exitCode).not.toBe(0);

      const logs = await dockerProvider.getLogTail(containerId);
      expect(logs).toMatch(/no response|no attempt|connection refused|could not connect/i);
    }, 60000);
  });

  describe('node container with database scripts', () => {
    it.skipIf(skipInCi)('executes JavaScript that simulates database operations', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'node-db-artifacts');
      await mkdir(artifactsPath, { recursive: true });

      // Write a JS script that simulates database-like operations
      const script = `
const fs = require('fs');
const path = require('path');

// Simulate database operations
const db = {
  users: [],
  insert(table, data) {
    this[table].push({ id: this[table].length + 1, ...data });
  },
  select(table) {
    return this[table];
  }
};

// Insert test data
db.insert('users', { name: 'Alice', email: 'alice@example.com' });
db.insert('users', { name: 'Bob', email: 'bob@example.com' });

// Query and output
const users = db.select('users');
console.log('Users:', JSON.stringify(users, null, 2));

// Write results to artifact
fs.writeFileSync(
  path.join('/mission/artifacts', 'db-results.json'),
  JSON.stringify({ success: true, count: users.length, data: users }, null, 2)
);

console.log('DATABASE_OPS_COMPLETE');
`;
      await writeFile(join(artifactsPath, 'db-script.js'), script);

      const containerId = await dockerProvider.start({
        missionId: 'm-node-db',
        runId: 'r-node-db',
        stepId: 'node-db-step',
        image: 'node:20-slim',
        artifactsPath,
        command: ['node', '/mission/artifacts/db-script.js'],
      });

      createdContainers.push(containerId);

      // Wait for container to complete
      let status = await dockerProvider.getStatus(containerId);
      const maxWait = 30;
      for (let i = 0; i < maxWait && status.state === 'running'; i++) {
        await new Promise(r => setTimeout(r, 1000));
        status = await dockerProvider.getStatus(containerId);
      }

      expect(status.state).toBe('exited');
      expect(status.exitCode).toBe(0);

      const logs = await dockerProvider.getLogTail(containerId);
      expect(logs).toContain('Alice');
      expect(logs).toContain('DATABASE_OPS_COMPLETE');

      // Verify artifact was written
      const resultPath = join(artifactsPath, 'db-results.json');
      expect(existsSync(resultPath)).toBe(true);

      const results = JSON.parse(await readFile(resultPath, 'utf-8'));
      expect(results.success).toBe(true);
      expect(results.count).toBe(2);
    }, 60000);

    it.skipIf(skipInCi)('handles script error with correct exit code', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'node-error-artifacts');
      await mkdir(artifactsPath, { recursive: true });

      // Write a script that throws an error
      const script = `
console.log('Starting...');
throw new Error('Simulated database connection failure');
`;
      await writeFile(join(artifactsPath, 'error-script.js'), script);

      const containerId = await dockerProvider.start({
        missionId: 'm-node-error',
        runId: 'r-node-error',
        stepId: 'node-error-step',
        image: 'node:20-slim',
        artifactsPath,
        command: ['node', '/mission/artifacts/error-script.js'],
      });

      createdContainers.push(containerId);

      // Wait for container to complete
      let status = await dockerProvider.getStatus(containerId);
      const maxWait = 30;
      for (let i = 0; i < maxWait && status.state === 'running'; i++) {
        await new Promise(r => setTimeout(r, 1000));
        status = await dockerProvider.getStatus(containerId);
      }

      expect(status.state).toBe('exited');
      expect(status.exitCode).not.toBe(0);

      const logs = await dockerProvider.getLogTail(containerId);
      expect(logs).toContain('database connection failure');
    }, 60000);

    it.skipIf(skipInCi)('reads input SQL file and processes it', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'sql-process-artifacts');
      await mkdir(artifactsPath, { recursive: true });

      // Write a mock SQL file
      const sqlFile = `
-- Create users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE
);

-- Insert initial data
INSERT INTO users (name, email) VALUES ('Test User', 'test@example.com');

-- Query
SELECT * FROM users;
`;
      await writeFile(join(artifactsPath, 'schema.sql'), sqlFile);

      // Write a Node script that parses the SQL
      const parseScript = `
const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync('/mission/artifacts/schema.sql', 'utf-8');
const statements = sql.split(';').filter(s => s.trim() && !s.trim().startsWith('--'));

console.log('Parsed SQL statements:');
statements.forEach((stmt, i) => {
  const trimmed = stmt.trim().split('\\n')[0];
  console.log(\`  \${i + 1}. \${trimmed.substring(0, 50)}...\`);
});

const output = {
  statementCount: statements.length,
  hasCreateTable: sql.includes('CREATE TABLE'),
  hasInsert: sql.includes('INSERT INTO'),
  hasSelect: sql.includes('SELECT')
};

fs.writeFileSync('/mission/artifacts/parse-result.json', JSON.stringify(output, null, 2));
console.log('SQL_PARSE_COMPLETE');
`;
      await writeFile(join(artifactsPath, 'parse-sql.js'), parseScript);

      const containerId = await dockerProvider.start({
        missionId: 'm-sql-parse',
        runId: 'r-sql-parse',
        stepId: 'sql-parse-step',
        image: 'node:20-slim',
        artifactsPath,
        command: ['node', '/mission/artifacts/parse-sql.js'],
      });

      createdContainers.push(containerId);

      // Wait for container to complete
      let status = await dockerProvider.getStatus(containerId);
      const maxWait = 30;
      for (let i = 0; i < maxWait && status.state === 'running'; i++) {
        await new Promise(r => setTimeout(r, 1000));
        status = await dockerProvider.getStatus(containerId);
      }

      expect(status.state).toBe('exited');
      expect(status.exitCode).toBe(0);

      const logs = await dockerProvider.getLogTail(containerId);
      expect(logs).toContain('SQL_PARSE_COMPLETE');

      const resultPath = join(artifactsPath, 'parse-result.json');
      expect(existsSync(resultPath)).toBe(true);

      const result = JSON.parse(await readFile(resultPath, 'utf-8'));
      expect(result.hasCreateTable).toBe(true);
      expect(result.hasInsert).toBe(true);
      expect(result.hasSelect).toBe(true);
    }, 60000);
  });

  describe('container lifecycle management', () => {
    it.skipIf(skipInCi)('stops running container', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'stop-artifacts');
      await mkdir(artifactsPath, { recursive: true });

      // Start a long-running process
      const containerId = await dockerProvider.start({
        missionId: 'm-stop-test',
        runId: 'r-stop-test',
        stepId: 'stop-test-step',
        image: 'node:20-slim',
        artifactsPath,
        command: ['node', '-e', 'setInterval(() => console.log("running"), 1000)'],
      });

      createdContainers.push(containerId);

      // Wait a moment for it to start
      await new Promise(r => setTimeout(r, 2000));

      // Verify it's running
      let status = await dockerProvider.getStatus(containerId);
      expect(status.state).toBe('running');

      // Stop it
      await dockerProvider.stop(containerId);

      // Wait for stop to complete
      await new Promise(r => setTimeout(r, 2000));

      status = await dockerProvider.getStatus(containerId);
      expect(status.state).toBe('exited');
    }, 30000);

    it.skipIf(skipInCi)('verifies container labels are set correctly', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'labels-artifacts');
      await mkdir(artifactsPath, { recursive: true });

      const containerId = await dockerProvider.start({
        missionId: 'm-label-test',
        runId: 'r-label-test',
        stepId: 'label-test-step',
        image: 'node:20-slim',
        artifactsPath,
        command: ['echo', 'labeled'],
      });

      createdContainers.push(containerId);

      // Wait for container to complete
      await new Promise(r => setTimeout(r, 2000));

      // Inspect container labels
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const { stdout } = await execAsync(`docker inspect --format='{{json .Config.Labels}}' ${containerId}`);
      const labels = JSON.parse(stdout.trim());

      expect(labels['haflow.mission_id']).toBe('m-label-test');
      expect(labels['haflow.run_id']).toBe('r-label-test');
      expect(labels['haflow.step_id']).toBe('label-test-step');
    }, 30000);

    it.skipIf(skipInCi)('passes environment variables to container', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'env-artifacts');
      await mkdir(artifactsPath, { recursive: true });

      const containerId = await dockerProvider.start({
        missionId: 'm-env-test',
        runId: 'r-env-test',
        stepId: 'env-test-step',
        image: 'node:20-slim',
        artifactsPath,
        env: {
          DATABASE_URL: 'postgres://user:pass@localhost/db',
          CUSTOM_VAR: 'haflow_test_value',
        },
        command: ['node', '-e', 'console.log("DB=" + process.env.DATABASE_URL); console.log("CUSTOM=" + process.env.CUSTOM_VAR)'],
      });

      createdContainers.push(containerId);

      // Wait for container to complete
      let status = await dockerProvider.getStatus(containerId);
      const maxWait = 15;
      for (let i = 0; i < maxWait && status.state === 'running'; i++) {
        await new Promise(r => setTimeout(r, 500));
        status = await dockerProvider.getStatus(containerId);
      }

      expect(status.state).toBe('exited');
      expect(status.exitCode).toBe(0);

      const logs = await dockerProvider.getLogTail(containerId);
      expect(logs).toContain('DB=postgres://user:pass@localhost/db');
      expect(logs).toContain('CUSTOM=haflow_test_value');
    }, 30000);

    it.skipIf(skipInCi)('removes container after completion', async () => {
      if (!dockerAvailable) return;

      const testDir = getTestDir();
      const artifactsPath = join(testDir, 'remove-artifacts');
      await mkdir(artifactsPath, { recursive: true });

      const containerId = await dockerProvider.start({
        missionId: 'm-remove-test',
        runId: 'r-remove-test',
        stepId: 'remove-test-step',
        image: 'node:20-slim',
        artifactsPath,
        command: ['echo', 'done'],
      });

      // Don't add to createdContainers - we're testing removal

      // Wait for it to finish
      await new Promise(r => setTimeout(r, 3000));

      // Remove it
      await dockerProvider.remove(containerId);

      // Verify it's gone
      const status = await dockerProvider.getStatus(containerId);
      expect(status.state).toBe('unknown');
    }, 30000);
  });
});
