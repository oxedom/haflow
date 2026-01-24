import express, { type Express } from 'express';
import cors from 'cors';
import { missionRoutes, workflowRoutes } from './routes/missions.js';
import { transcriptionRoutes } from './routes/transcription.js';

export function createServer(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use('/api/missions', missionRoutes);
  app.use('/api/workflows', workflowRoutes);
  app.use('/api/transcribe', transcriptionRoutes);

  // Error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({
      success: false,
      data: null,
      error: err.message,
    });
  });

  return app;
}
