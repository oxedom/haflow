import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../utils/errors';

/**
 * Middleware factory that validates request body against a Zod schema.
 * On success, replaces req.body with the parsed/transformed data.
 * On failure, throws ValidationError with the Zod issues.
 *
 * Usage: router.post('/', validateBody(CreateProjectSchema), handler)
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(new ValidationError(err.issues));
      } else {
        next(err);
      }
    }
  };
}
