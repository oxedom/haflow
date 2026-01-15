/**
 * Entry point for the Ralphy backend server.
 *
 * This file initializes the database, runs recovery, and starts the HTTP server.
 * It also handles graceful shutdown on SIGTERM/SIGINT signals.
 */
import { initializeDatabase, closeDatabase } from './database';
import { runRecovery } from './services/recovery';
import { createApp } from './server';
import { config } from './config';
import { getOrchestrator } from './services/orchestrator';
import { getLogManager } from './services/log-manager';
import { getSSEManager } from './services/sse-manager';
import type { Server } from 'http';

let server: Server | null = null;
let isShuttingDown = false;

/**
 * Main entry point.
 * Initializes database, runs recovery, and starts the server.
 */
async function main(): Promise<void> {
  console.log('Starting Ralphy backend server...');

  // Initialize database
  console.log('Initializing database...');
  initializeDatabase();

  // Run recovery to handle any missions that were in progress when server stopped
  console.log('Running recovery...');
  try {
    const recoveryResults = await runRecovery();
    if (recoveryResults.length > 0) {
      console.log(`Recovery processed ${recoveryResults.length} mission(s):`);
      for (const result of recoveryResults) {
        console.log(`  - ${result.missionId}: ${result.action} - ${result.details}`);
      }
    } else {
      console.log('No missions needed recovery.');
    }
  } catch (err) {
    console.error('Recovery failed:', err);
    // Continue starting the server even if recovery fails
  }

  // Create and start the server
  const app = createApp();
  const { PORT, HOST } = config;

  server = app.listen(PORT, HOST, () => {
    console.log(`Ralphy backend server listening on http://${HOST}:${PORT}`);
    console.log('Press Ctrl+C to stop.');
  });

  // Handle server errors
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use.`);
    } else {
      console.error('Server error:', err);
    }
    process.exit(1);
  });
}

/**
 * Graceful shutdown handler.
 * Closes server, cleans up services, and closes database.
 */
async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

  // Close HTTP server first (stop accepting new connections)
  if (server) {
    await new Promise<void>((resolve) => {
      server!.close(() => {
        console.log('HTTP server closed.');
        resolve();
      });
    });
  }

  // Cleanup services
  try {
    // Cleanup orchestrator (kills any running processes)
    const orchestrator = getOrchestrator();
    orchestrator.cleanup();
    console.log('Orchestrator cleaned up.');
  } catch {
    // Orchestrator may not be initialized
  }

  try {
    // Cleanup log manager (closes file streams)
    const logManager = getLogManager();
    logManager.cleanup();
    console.log('Log manager cleaned up.');
  } catch {
    // Log manager may not be initialized
  }

  try {
    // Cleanup SSE manager (closes client connections)
    const sseManager = getSSEManager();
    sseManager.cleanup();
    console.log('SSE manager cleaned up.');
  } catch {
    // SSE manager may not be initialized
  }

  // Close database connection
  closeDatabase();
  console.log('Database connection closed.');

  console.log('Graceful shutdown complete.');
  process.exit(0);
}

// Register signal handlers for graceful shutdown
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  shutdown('uncaughtException').catch(() => process.exit(1));
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  // Don't exit on unhandled rejections, just log them
});

// Start the server
main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
