import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectRepository } from '../database/repositories/projects';
import { validateBody } from '../middleware/validation';
import { CreateProjectSchema, UpdateProjectSchema } from '../utils/validators';
import { NotFoundError, ValidationError } from '../utils/errors';

const router: Router = Router();
const projectRepo = new ProjectRepository();

/**
 * POST /
 * Create a new project
 * Validates that path exists and is a git repository
 */
router.post(
  '/',
  validateBody(CreateProjectSchema),
  ((req: Request, res: Response, next: NextFunction): void => {
    try {
      const { path: projectPath, name } = req.body;

      // Check if path exists
      if (!fs.existsSync(projectPath)) {
        throw new ValidationError([
          {
            code: 'custom',
            path: ['path'],
            message: `Path does not exist: ${projectPath}`,
          },
        ]);
      }

      // Check if path is a directory
      const stat = fs.statSync(projectPath);
      if (!stat.isDirectory()) {
        throw new ValidationError([
          {
            code: 'custom',
            path: ['path'],
            message: `Path is not a directory: ${projectPath}`,
          },
        ]);
      }

      // Check if .git exists (is a git repository)
      const gitPath = path.join(projectPath, '.git');
      if (!fs.existsSync(gitPath)) {
        throw new ValidationError([
          {
            code: 'custom',
            path: ['path'],
            message: `Path is not a git repository (no .git found): ${projectPath}`,
          },
        ]);
      }

      // Check if project with this path already exists
      const existing = projectRepo.findByPath(projectPath);
      if (existing) {
        throw new ValidationError([
          {
            code: 'custom',
            path: ['path'],
            message: `Project already registered at path: ${projectPath}`,
          },
        ]);
      }

      const project = projectRepo.create({ name, path: projectPath });
      res.status(201).json(project);
    } catch (err) {
      next(err);
    }
  }) as RequestHandler
);

/**
 * GET /
 * List all projects with their mission counts
 */
router.get('/', ((_req: Request, res: Response, next: NextFunction): void => {
  try {
    const projects = projectRepo.findAll();
    res.json(projects);
  } catch (err) {
    next(err);
  }
}) as RequestHandler);

/**
 * GET /:id
 * Get a single project by ID
 */
router.get('/:id', ((req: Request, res: Response, next: NextFunction): void => {
  try {
    const id = req.params.id as string;
    const project = projectRepo.findById(id);
    if (!project) {
      throw new NotFoundError('Project', id);
    }
    res.json(project);
  } catch (err) {
    next(err);
  }
}) as RequestHandler);

/**
 * PATCH /:id
 * Update a project
 */
router.patch(
  '/:id',
  validateBody(UpdateProjectSchema),
  ((req: Request, res: Response, next: NextFunction): void => {
    try {
      const id = req.params.id as string;
      const project = projectRepo.update(id, req.body);
      res.json(project);
    } catch (err) {
      next(err);
    }
  }) as RequestHandler
);

/**
 * DELETE /:id
 * Delete a project
 * Throws error if project has active missions
 */
router.delete('/:id', ((req: Request, res: Response, next: NextFunction): void => {
  try {
    const id = req.params.id as string;
    projectRepo.delete(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}) as RequestHandler);

export const projectsRouter = router;
