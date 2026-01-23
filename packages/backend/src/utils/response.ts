import type { ApiResponse } from '@haloop/shared';
import type { Response } from 'express';

export function sendSuccess<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({
    success: true,
    data,
    error: null,
  } satisfies ApiResponse<T>);
}

export function sendError(res: Response, error: string, status = 400): void {
  res.status(status).json({
    success: false,
    data: null,
    error,
  } satisfies ApiResponse<null>);
}
