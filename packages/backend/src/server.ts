import express, { Application, Router } from 'express';
import helmet from 'helmet';
import cors from 'cors';

import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/error-handler';
import { healthRouter } from './routes/health';
import { projectsRouter } from './routes/projects';
import { missionsRouter } from './routes/missions';
import { processesRouter } from './routes/processes';

/**
 * Creates and configures the Express application.
 *
 * Middleware order:
 * 1. helmet() - Security headers
 * 2. cors() - CORS support
 * 3. express.json() - Body parsing
 * 4. /health - Health check (before auth)
 * 5. authMiddleware - Authentication
 * 6. /api/* - API routes
 * 7. errorHandler - Global error handler (last)
 */
export function createApp(): Application {
  const app: Application = express();

  // Security headers
  app.use(helmet());

  // CORS support
  app.use(cors());

  // Body parsing
  app.use(express.json());

  // Health check endpoint - before auth middleware
  app.use('/health', healthRouter);

  // Authentication middleware - after health check
  app.use(authMiddleware);

  // API routes
  const apiRouter: Router = Router();
  apiRouter.use('/projects', projectsRouter);
  apiRouter.use('/missions', missionsRouter);
  apiRouter.use('/processes', processesRouter);

  app.use('/api', apiRouter);

  // Global error handler - must be last
  app.use(errorHandler);

  return app;
}

/**
 * Exported app instance for use in index.ts
 */
export const app = createApp();
