import { Response } from 'express';

/**
 * SSEManager class for managing Server-Sent Events connections.
 * Handles client registration, removal, and broadcasting events.
 */
export class SSEManager {
  /**
   * Map of processId to Set of Response objects (clients subscribed to that process)
   */
  private clients: Map<string, Set<Response>> = new Map();

  /**
   * Map of processId to event counter for generating event IDs
   */
  private eventCounters: Map<string, number> = new Map();

  /**
   * Add a client to receive SSE events for a process.
   * Sets appropriate headers and sends initial retry configuration.
   *
   * @param processId - The ID of the process to subscribe to
   * @param res - The Express Response object
   */
  addClient(processId: string, res: Response): void {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Disable compression for SSE
    res.setHeader('X-Accel-Buffering', 'no');

    // Send retry configuration immediately
    res.write('retry: 10000\n\n');

    // Flush headers
    res.flushHeaders();

    // Get or create the client set for this process
    let clientSet = this.clients.get(processId);
    if (!clientSet) {
      clientSet = new Set();
      this.clients.set(processId, clientSet);
    }

    // Add the client
    clientSet.add(res);

    // Initialize event counter if not present
    if (!this.eventCounters.has(processId)) {
      this.eventCounters.set(processId, 0);
    }

    // Handle client disconnect
    res.on('close', () => {
      this.removeClient(processId, res);
    });
  }

  /**
   * Remove a client from the SSE subscriptions.
   *
   * @param processId - The ID of the process
   * @param res - The Express Response object to remove
   */
  removeClient(processId: string, res: Response): void {
    const clientSet = this.clients.get(processId);
    if (clientSet) {
      clientSet.delete(res);
      // Clean up empty sets
      if (clientSet.size === 0) {
        this.clients.delete(processId);
      }
    }
  }

  /**
   * Broadcast an event to all clients subscribed to a process.
   *
   * @param processId - The ID of the process
   * @param eventId - The event ID for SSE resumption support
   * @param data - The data to send (will be JSON stringified if object)
   */
  broadcast(processId: string, eventId: string, data: string | object): void {
    const clientSet = this.clients.get(processId);
    if (!clientSet || clientSet.size === 0) {
      return;
    }

    // Format data as string
    const dataString = typeof data === 'object' ? JSON.stringify(data) : data;

    // Format SSE message
    const message = `id: ${eventId}\ndata: ${dataString}\n\n`;

    // Send to all clients
    for (const res of clientSet) {
      try {
        res.write(message);
      } catch {
        // Client may have disconnected, remove it
        this.removeClient(processId, res);
      }
    }
  }

  /**
   * Send an event to all clients without an event ID.
   * Useful for sending initial data or heartbeats.
   *
   * @param processId - The ID of the process
   * @param data - The data to send
   */
  send(processId: string, data: string | object): void {
    const clientSet = this.clients.get(processId);
    if (!clientSet || clientSet.size === 0) {
      return;
    }

    // Format data as string
    const dataString = typeof data === 'object' ? JSON.stringify(data) : data;

    // Format SSE message without ID
    const message = `data: ${dataString}\n\n`;

    // Send to all clients
    for (const res of clientSet) {
      try {
        res.write(message);
      } catch {
        // Client may have disconnected, remove it
        this.removeClient(processId, res);
      }
    }
  }

  /**
   * Generate the next event ID for a process.
   *
   * @param processId - The ID of the process
   * @returns The next sequential event ID
   */
  getNextEventId(processId: string): string {
    const current = this.eventCounters.get(processId) || 0;
    const next = current + 1;
    this.eventCounters.set(processId, next);
    return next.toString();
  }

  /**
   * Get the current event ID counter for a process.
   *
   * @param processId - The ID of the process
   * @returns The current event counter value
   */
  getCurrentEventId(processId: string): number {
    return this.eventCounters.get(processId) || 0;
  }

  /**
   * Check if a process has any connected clients.
   *
   * @param processId - The ID of the process
   * @returns True if there are connected clients
   */
  hasClients(processId: string): boolean {
    const clientSet = this.clients.get(processId);
    return clientSet !== undefined && clientSet.size > 0;
  }

  /**
   * Get the number of connected clients for a process.
   *
   * @param processId - The ID of the process
   * @returns The number of connected clients
   */
  getClientCount(processId: string): number {
    const clientSet = this.clients.get(processId);
    return clientSet ? clientSet.size : 0;
  }

  /**
   * Cleanup all clients for a specific process.
   * Ends all Response streams.
   *
   * @param processId - The ID of the process
   */
  closeProcess(processId: string): void {
    const clientSet = this.clients.get(processId);
    if (clientSet) {
      for (const res of clientSet) {
        try {
          res.end();
        } catch {
          // Ignore errors during cleanup
        }
      }
      this.clients.delete(processId);
    }
    this.eventCounters.delete(processId);
  }

  /**
   * Cleanup all resources.
   * Should be called during graceful shutdown.
   */
  cleanup(): void {
    for (const [processId] of this.clients) {
      this.closeProcess(processId);
    }
    this.clients.clear();
    this.eventCounters.clear();
  }
}

// Singleton instance
let sseManagerInstance: SSEManager | null = null;

/**
 * Get the singleton SSEManager instance
 */
export function getSSEManager(): SSEManager {
  if (!sseManagerInstance) {
    sseManagerInstance = new SSEManager();
  }
  return sseManagerInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetSSEManager(): void {
  if (sseManagerInstance) {
    sseManagerInstance.cleanup();
  }
  sseManagerInstance = null;
}
