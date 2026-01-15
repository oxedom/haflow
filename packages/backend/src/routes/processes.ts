import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { ProcessRepository } from '../database/repositories/processes';
import { validateBody } from '../middleware/validation';
import { SignalSchema } from '../utils/validators';
import { NotFoundError } from '../utils/errors';
import { getLogManager } from '../services/log-manager';
import { getSSEManager } from '../services/sse-manager';
import { getOrchestrator } from '../services/orchestrator';

const router: Router = Router();
const processRepo = new ProcessRepository();

/**
 * GET /
 * List all processes
 */
router.get('/', ((_req: Request, res: Response, next: NextFunction): void => {
  try {
    const processes = processRepo.findRunning();
    res.json(processes);
  } catch (err) {
    next(err);
  }
}) as RequestHandler);

/**
 * GET /:id
 * Get a single process by ID
 */
router.get('/:id', ((req: Request, res: Response, next: NextFunction): void => {
  try {
    const id = req.params.id as string;
    const process = processRepo.findById(id);
    if (!process) {
      throw new NotFoundError('Process', id);
    }
    res.json(process);
  } catch (err) {
    next(err);
  }
}) as RequestHandler);

/**
 * GET /:id/logs
 * Get full log file content for a process
 */
router.get('/:id/logs', ((req: Request, res: Response, next: NextFunction): void => {
  try {
    const id = req.params.id as string;

    // Verify process exists
    const process = processRepo.findById(id);
    if (!process) {
      throw new NotFoundError('Process', id);
    }

    const logManager = getLogManager();
    const content = logManager.readLogFile(id);

    if (content === null) {
      // Log file may not exist yet or process has no logs
      res.json({ content: '', lines: [] });
      return;
    }

    res.json({
      content,
      lines: content.split('\n').filter(line => line !== '')
    });
  } catch (err) {
    next(err);
  }
}) as RequestHandler);

/**
 * GET /:id/logs/stream
 * Stream logs via Server-Sent Events
 *
 * Supports Last-Event-Id header for resumption from a specific event
 */
router.get('/:id/logs/stream', ((req: Request, res: Response, next: NextFunction): void => {
  try {
    const id = req.params.id as string;

    // Verify process exists
    const process = processRepo.findById(id);
    if (!process) {
      throw new NotFoundError('Process', id);
    }

    const sseManager = getSSEManager();
    const logManager = getLogManager();

    // Register the client for SSE events
    sseManager.addClient(id, res);

    // Handle Last-Event-Id for resumption
    const lastEventId = req.headers['last-event-id'] as string | undefined;
    const lastEventNum = lastEventId ? parseInt(lastEventId, 10) : 0;

    // Get the current event counter
    const currentEventNum = sseManager.getCurrentEventId(id);

    // Send ring buffer contents immediately for clients catching up
    const recentLines = logManager.getRecentLines(id);

    if (recentLines.length > 0) {
      // If client is resuming, only send events after their last received event
      // Since ring buffer doesn't track event IDs, we send all recent lines as a bulk event
      if (lastEventNum === 0 || lastEventNum < currentEventNum) {
        // Send each line as a separate event for proper event ID tracking
        for (const line of recentLines) {
          const eventId = sseManager.getNextEventId(id);
          sseManager.broadcast(id, eventId, { type: 'log', data: line });
        }
      }
    }

    // The connection stays open - new events will be sent via broadcast
    // when orchestrator emits output events

  } catch (err) {
    next(err);
  }
}) as RequestHandler);

/**
 * POST /:id/signal
 * Send a signal to a process (SIGTERM or SIGKILL)
 */
router.post(
  '/:id/signal',
  validateBody(SignalSchema),
  ((req: Request, res: Response, next: NextFunction): void => {
    const id = req.params.id as string;
    const { signal } = req.body as { signal: 'SIGTERM' | 'SIGKILL' };

    // Verify process exists
    const process = processRepo.findById(id);
    if (!process) {
      next(new NotFoundError('Process', id));
      return;
    }

    const orchestrator = getOrchestrator();

    orchestrator
      .kill(id, signal)
      .then(() => {
        // Fetch updated process after signal
        const updatedProcess = processRepo.findById(id);
        res.json(updatedProcess || { id, status: 'canceled' });
      })
      .catch((err) => {
        next(err);
      });
  }) as RequestHandler
);

export const processesRouter = router;
