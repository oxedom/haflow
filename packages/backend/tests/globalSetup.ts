import type { GlobalSetupContext } from 'vitest/node';

export default async function globalSetup({ provide }: GlobalSetupContext) {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.PORT = '4001'; // Use different port for tests

  // Dynamic import to avoid module caching issues
  const { createServer } = await import('../src/server.js');
  const server = createServer();

  await new Promise<void>((resolve) => {
    server.listen(4001, () => {
      console.log('Test server started on port 4001');
      resolve();
    });
  });

  // Store server reference for teardown
  (globalThis as any).__TEST_SERVER__ = server;

  // Provide port to tests
  provide('serverPort', 4001);
}
