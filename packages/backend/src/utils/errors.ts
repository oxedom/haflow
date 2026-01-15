import type { ZodIssue } from 'zod';

/**
 * Error thrown when a requested resource is not found
 */
export class NotFoundError extends Error {
  public readonly resource: string;
  public readonly id: string;

  constructor(resource: string, id: string) {
    super(`${resource} with id '${id}' not found`);
    this.name = 'NotFoundError';
    this.resource = resource;
    this.id = id;
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Error thrown when request validation fails
 */
export class ValidationError extends Error {
  public readonly issues: ZodIssue[];

  constructor(issues: ZodIssue[]) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.issues = issues;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Error thrown when an invalid state transition is attempted
 */
export class InvalidStateTransitionError extends Error {
  public readonly from: string;
  public readonly to: string;

  constructor(from: string, to: string) {
    super(`Invalid state transition from '${from}' to '${to}'`);
    this.name = 'InvalidStateTransitionError';
    this.from = from;
    this.to = to;
    Object.setPrototypeOf(this, InvalidStateTransitionError.prototype);
  }
}
