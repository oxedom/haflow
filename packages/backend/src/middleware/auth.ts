import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { config } from '../config';

/**
 * Authentication middleware that checks the Authorization header.
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * If RALPHY_API_TOKEN is not set, all requests are allowed.
 * The /health endpoint is always allowed without authentication.
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Skip authentication for health check endpoint
  if (req.path === '/health') {
    next();
    return;
  }

  // If no token is configured, allow all requests
  const expectedToken = config.RALPHY_API_TOKEN;
  if (!expectedToken) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;

  // Check for missing Authorization header
  if (!authHeader) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Extract token from 'Bearer <token>' format
  const parts = authHeader.split(' ');
  const token = parts[1];
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Use timing-safe comparison to prevent timing attacks
  try {
    const tokenBuffer = Buffer.from(token);
    const expectedBuffer = Buffer.from(expectedToken);

    // timingSafeEqual requires both buffers to have the same length
    // If lengths differ, the tokens definitely don't match
    if (tokenBuffer.length !== expectedBuffer.length) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!timingSafeEqual(tokenBuffer, expectedBuffer)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Token is valid
  next();
}
