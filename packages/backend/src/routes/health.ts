import { Router, Request, Response, RequestHandler } from 'express';
import { getDatabase } from '../database';
import { getDockerManager } from '../services/docker-manager';

const router: Router = Router();

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  database: 'ok' | 'error';
  docker: 'ok' | 'error';
  databaseError?: string;
  dockerError?: string;
}

/**
 * GET /health
 * Health check endpoint that verifies database and Docker connectivity.
 * Returns 200 with healthy status or 503 with unhealthy status.
 */
router.get('/', (async (_req: Request, res: Response): Promise<void> => {
  const healthStatus: HealthStatus = {
    status: 'healthy',
    database: 'ok',
    docker: 'ok',
  };

  // Check database connectivity
  try {
    const db = getDatabase();
    db.prepare('SELECT 1').get();
  } catch (err) {
    healthStatus.database = 'error';
    healthStatus.databaseError = err instanceof Error ? err.message : 'Unknown database error';
  }

  // Check Docker connectivity
  try {
    const dockerManager = getDockerManager();
    const dockerOk = await dockerManager.ping();
    if (!dockerOk) {
      healthStatus.docker = 'error';
      healthStatus.dockerError = 'Docker daemon not responding';
    }
  } catch (err) {
    healthStatus.docker = 'error';
    healthStatus.dockerError = err instanceof Error ? err.message : 'Unknown Docker error';
  }

  // Determine overall status
  if (healthStatus.database === 'error' || healthStatus.docker === 'error') {
    healthStatus.status = 'unhealthy';
    res.status(503).json(healthStatus);
  } else {
    res.json(healthStatus);
  }
}) as unknown as RequestHandler);

export const healthRouter = router;
