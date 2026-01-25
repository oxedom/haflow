import { Router, type Router as RouterType } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { sendSuccess, sendError } from '../utils/response.js';

const execAsync = promisify(exec);

export const systemRoutes: RouterType = Router();

// DELETE /api/system/cleanup-containers - Clean up all haflow-claude containers
systemRoutes.delete('/cleanup-containers', async (_req, res, next) => {
  try {
    // List all containers with names starting with "haflow-claude"
    const { stdout: listOutput } = await execAsync(
      `docker ps -a --filter "name=haflow-claude" --format "{{.ID}}"`
    );

    const containerIds = listOutput.trim().split('\n').filter(Boolean);

    if (containerIds.length === 0) {
      return sendSuccess(res, { removed: 0, message: 'No containers to clean up' });
    }

    // Force remove all matched containers
    let removed = 0;
    const errors: string[] = [];

    for (const id of containerIds) {
      try {
        await execAsync(`docker rm -f ${id}`);
        removed++;
      } catch (err) {
        errors.push(`Failed to remove ${id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    sendSuccess(res, {
      removed,
      total: containerIds.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Cleaned up ${removed} container(s)`,
    });
  } catch (err) {
    // Docker might not be available
    if (err instanceof Error && err.message.includes('Cannot connect to the Docker daemon')) {
      return sendError(res, 'Docker is not available', 503);
    }
    next(err);
  }
});
