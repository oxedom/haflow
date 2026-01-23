import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default async function globalTeardown() {
  // Stop the test server
  const server = (globalThis as any).__TEST_SERVER__;
  if (server) {
    await new Promise<void>((resolve) => {
      server.close(() => {
        console.log('Test server stopped');
        resolve();
      });
    });
  }

  // Cleanup any orphaned Docker containers from tests
  try {
    const { stdout } = await execAsync(
      'docker ps -aq --filter="label=ralphy.mission_id"'
    );
    const containerIds = stdout.trim().split('\n').filter(Boolean);
    for (const id of containerIds) {
      await execAsync(`docker rm -f ${id}`).catch(() => {});
    }
    if (containerIds.length > 0) {
      console.log(`Cleaned up ${containerIds.length} orphaned containers`);
    }
  } catch {
    // Docker not available or no containers to clean
  }
}
