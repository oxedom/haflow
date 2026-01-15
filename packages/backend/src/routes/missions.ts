import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { MissionRepository } from '../database/repositories/missions';
import { ProjectRepository } from '../database/repositories/projects';
import { TaskRepository } from '../database/repositories/tasks';
import { validateBody } from '../middleware/validation';
import { CreateMissionSchema, UpdateMissionSchema, RejectSchema } from '../utils/validators';
import { NotFoundError } from '../utils/errors';
import { getMissionExecutor } from '../services/mission-executor';

const router: Router = Router();
const missionRepo = new MissionRepository();
const projectRepo = new ProjectRepository();
const taskRepo = new TaskRepository();

/**
 * POST /
 * Create a new mission with state='draft'
 */
router.post(
  '/',
  validateBody(CreateMissionSchema),
  ((req: Request, res: Response, next: NextFunction): void => {
    try {
      const { projectId, featureName, description } = req.body;

      // Verify project exists
      const project = projectRepo.findById(projectId);
      if (!project) {
        throw new NotFoundError('Project', projectId);
      }

      const mission = missionRepo.create({
        project_id: projectId,
        feature_name: featureName,
        description,
      });

      res.status(201).json(mission);
    } catch (err) {
      next(err);
    }
  }) as RequestHandler
);

/**
 * GET /
 * List all missions
 */
router.get('/', ((_req: Request, res: Response, next: NextFunction): void => {
  try {
    const missions = missionRepo.findAll();
    res.json(missions);
  } catch (err) {
    next(err);
  }
}) as RequestHandler);

/**
 * GET /:id
 * Get a single mission by ID
 */
router.get('/:id', ((req: Request, res: Response, next: NextFunction): void => {
  try {
    const id = req.params.id as string;
    const mission = missionRepo.findById(id);
    if (!mission) {
      throw new NotFoundError('Mission', id);
    }
    res.json(mission);
  } catch (err) {
    next(err);
  }
}) as RequestHandler);

/**
 * GET /:id/tasks
 * Get tasks for a mission
 */
router.get('/:id/tasks', ((req: Request, res: Response, next: NextFunction): void => {
  try {
    const id = req.params.id as string;
    const mission = missionRepo.findById(id);
    if (!mission) {
      throw new NotFoundError('Mission', id);
    }
    const tasks = taskRepo.findByMission(id);
    res.json(tasks);
  } catch (err) {
    next(err);
  }
}) as RequestHandler);

/**
 * PATCH /:id
 * Update a mission
 */
router.patch(
  '/:id',
  validateBody(UpdateMissionSchema),
  ((req: Request, res: Response, next: NextFunction): void => {
    try {
      const id = req.params.id as string;
      const mission = missionRepo.update(id, req.body);
      res.json(mission);
    } catch (err) {
      next(err);
    }
  }) as RequestHandler
);

/**
 * DELETE /:id
 * Delete a mission
 */
router.delete('/:id', ((req: Request, res: Response, next: NextFunction): void => {
  try {
    const id = req.params.id as string;
    missionRepo.delete(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}) as RequestHandler);

/**
 * POST /:id/start
 * Start a mission - creates worktree, transitions to generating_prd, spawns Claude
 */
router.post('/:id/start', ((req: Request, res: Response, next: NextFunction): void => {
  const id = req.params.id as string;
  const missionExecutor = getMissionExecutor();

  missionExecutor
    .start(id)
    .then((mission) => {
      res.json(mission);
    })
    .catch((err) => {
      next(err);
    });
}) as RequestHandler);

/**
 * POST /:id/prd/approve
 * Approve the PRD - transitions from prd_review to preparing_tasks
 */
router.post('/:id/prd/approve', ((req: Request, res: Response, next: NextFunction): void => {
  const id = req.params.id as string;
  const missionExecutor = getMissionExecutor();

  missionExecutor
    .approvePRD(id)
    .then((mission) => {
      res.json(mission);
    })
    .catch((err) => {
      next(err);
    });
}) as RequestHandler);

/**
 * POST /:id/prd/reject
 * Reject the PRD - stores notes, increments iterations, regenerates
 */
router.post(
  '/:id/prd/reject',
  validateBody(RejectSchema),
  ((req: Request, res: Response, next: NextFunction): void => {
    const id = req.params.id as string;
    const { notes } = req.body;
    const missionExecutor = getMissionExecutor();

    missionExecutor
      .rejectPRD(id, notes)
      .then((mission) => {
        res.json(mission);
      })
      .catch((err) => {
        next(err);
      });
  }) as RequestHandler
);

/**
 * POST /:id/tasks/approve
 * Approve tasks - creates Docker container, transitions to in_progress, executes tasks
 */
router.post('/:id/tasks/approve', ((req: Request, res: Response, next: NextFunction): void => {
  const id = req.params.id as string;
  const missionExecutor = getMissionExecutor();

  missionExecutor
    .approveTasks(id)
    .then((mission) => {
      res.json(mission);
    })
    .catch((err) => {
      next(err);
    });
}) as RequestHandler);

/**
 * POST /:id/tasks/reject
 * Reject tasks - stores notes, increments iterations, regenerates
 */
router.post(
  '/:id/tasks/reject',
  validateBody(RejectSchema),
  ((req: Request, res: Response, next: NextFunction): void => {
    const id = req.params.id as string;
    const { notes } = req.body;
    const missionExecutor = getMissionExecutor();

    missionExecutor
      .rejectTasks(id, notes)
      .then((mission) => {
        res.json(mission);
      })
      .catch((err) => {
        next(err);
      });
  }) as RequestHandler
);

/**
 * POST /:id/cancel
 * Cancel a mission - sends SIGTERM, waits, sends SIGKILL, marks as failed
 */
router.post('/:id/cancel', ((req: Request, res: Response, next: NextFunction): void => {
  const id = req.params.id as string;
  const missionExecutor = getMissionExecutor();

  missionExecutor
    .cancel(id)
    .then((mission) => {
      res.json(mission);
    })
    .catch((err) => {
      next(err);
    });
}) as RequestHandler);

export const missionsRouter = router;
