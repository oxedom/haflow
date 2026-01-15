import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import {
  NotFoundError,
  ValidationError,
  InvalidStateTransitionError,
} from '../utils/errors';

/**
 * Global error handler middleware for Express.
 * Catches all errors and returns appropriate HTTP status and JSON body.
 *
 * Must be the last middleware in the chain.
 * Signature has 4 params to be recognized as Express error handler.
 */
export const errorHandler: ErrorRequestHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // ValidationError -> 400
  if (err instanceof ValidationError) {
    res.status(400).json({
      error: 'Validation failed',
      details: err.issues,
    });
    return;
  }

  // NotFoundError -> 404
  if (err instanceof NotFoundError) {
    res.status(404).json({
      error: err.message,
    });
    return;
  }

  // InvalidStateTransitionError -> 409 Conflict
  if (err instanceof InvalidStateTransitionError) {
    res.status(409).json({
      error: err.message,
      from: err.from,
      to: err.to,
    });
    return;
  }

  // Unknown errors -> 500, log with console.error (can be replaced with pino later)
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
  });
};
