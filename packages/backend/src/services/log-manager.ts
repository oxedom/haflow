import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';

/**
 * Maximum number of lines to keep in the ring buffer per process
 */
const RING_BUFFER_SIZE = 100;

/**
 * LogManager service for managing process log files and in-memory ring buffers.
 * Handles writing logs to disk and maintaining recent log lines in memory for quick access.
 */
export class LogManager {
  /**
   * Map of processId to WriteStream for log files
   */
  private streams: Map<string, fs.WriteStream> = new Map();

  /**
   * Map of processId to ring buffer (array of recent log lines)
   */
  private ringBuffers: Map<string, string[]> = new Map();

  /**
   * Map of processId to missionId for log path resolution
   */
  private processMissionMap: Map<string, string> = new Map();

  /**
   * Get the log directory path for a mission
   */
  private getLogDir(missionId: string): string {
    return path.join(config.RALPHY_HOME, 'logs', 'missions', missionId);
  }

  /**
   * Get the log file path for a process
   */
  getLogPath(processId: string): string | null {
    const missionId = this.processMissionMap.get(processId);
    if (!missionId) {
      return null;
    }
    return path.join(this.getLogDir(missionId), `${processId}.log`);
  }

  /**
   * Create a log file stream for a process.
   * Creates the directory structure if it doesn't exist.
   *
   * @param processId - The ID of the process
   * @param missionId - The ID of the mission this process belongs to
   * @returns The path to the log file
   */
  createLogStream(processId: string, missionId: string): string {
    // Store the mapping
    this.processMissionMap.set(processId, missionId);

    // Initialize ring buffer for this process
    this.ringBuffers.set(processId, []);

    // Create directory structure
    const logDir = this.getLogDir(missionId);
    fs.mkdirSync(logDir, { recursive: true });

    // Create the log file path
    const logPath = path.join(logDir, `${processId}.log`);

    // Create write stream
    const stream = fs.createWriteStream(logPath, { flags: 'a' });
    this.streams.set(processId, stream);

    return logPath;
  }

  /**
   * Write data to a process log.
   * Writes to both the file stream and the ring buffer.
   *
   * @param processId - The ID of the process
   * @param data - The data to write
   */
  write(processId: string, data: string): void {
    // Write to file stream if it exists
    const stream = this.streams.get(processId);
    if (stream) {
      stream.write(data);
    }

    // Update ring buffer
    const ringBuffer = this.ringBuffers.get(processId);
    if (ringBuffer) {
      // Split data into lines and add to buffer
      const lines = data.split('\n');
      for (const line of lines) {
        // Don't add empty lines from split
        if (line !== '' || data.endsWith('\n')) {
          ringBuffer.push(line);
          // Maintain buffer size limit
          while (ringBuffer.length > RING_BUFFER_SIZE) {
            ringBuffer.shift();
          }
        }
      }
    }
  }

  /**
   * Get recent log lines for a process from the ring buffer.
   *
   * @param processId - The ID of the process
   * @returns Array of recent log lines, or empty array if process not found
   */
  getRecentLines(processId: string): string[] {
    return this.ringBuffers.get(processId) || [];
  }

  /**
   * Close the log stream for a process and cleanup resources.
   *
   * @param processId - The ID of the process
   */
  closeStream(processId: string): void {
    const stream = this.streams.get(processId);
    if (stream) {
      stream.end();
      this.streams.delete(processId);
    }
  }

  /**
   * Read the full log file for a process.
   *
   * @param processId - The ID of the process
   * @returns The log file contents, or null if not found
   */
  readLogFile(processId: string): string | null {
    const logPath = this.getLogPath(processId);
    if (!logPath) {
      return null;
    }

    try {
      return fs.readFileSync(logPath, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Check if a log stream exists for a process
   */
  hasStream(processId: string): boolean {
    return this.streams.has(processId);
  }

  /**
   * Cleanup all streams and buffers.
   * Should be called during graceful shutdown.
   */
  cleanup(): void {
    // Close all streams
    for (const [processId, stream] of this.streams) {
      stream.end();
      this.streams.delete(processId);
    }
    // Clear all ring buffers
    this.ringBuffers.clear();
    // Clear process-mission mapping
    this.processMissionMap.clear();
  }
}

// Singleton instance
let logManagerInstance: LogManager | null = null;

/**
 * Get the singleton LogManager instance
 */
export function getLogManager(): LogManager {
  if (!logManagerInstance) {
    logManagerInstance = new LogManager();
  }
  return logManagerInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetLogManager(): void {
  if (logManagerInstance) {
    logManagerInstance.cleanup();
  }
  logManagerInstance = null;
}
