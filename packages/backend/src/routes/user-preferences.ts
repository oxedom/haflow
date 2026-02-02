import { Router, type Router as RouterType, type Request, type Response } from 'express';
import { userPreferencesService } from '../services/user-preferences.js';
import { sendSuccess, sendError } from '../utils/response.js';
import type { AudioNotificationPreferences } from '@haflow/shared';

export const userPreferencesRoutes: RouterType = Router();

// GET /api/user/preferences - Fetch current user preferences
userPreferencesRoutes.get('/preferences', async (req: Request, res: Response, next) => {
  try {
    // Get user ID from session/auth - for now use a default
    // In a real app, this would come from req.user or similar
    const userId = (req as any).userId || 'default-user';

    const preferences = await userPreferencesService.getUserPreferences(userId);
    sendSuccess(res, preferences);
  } catch (error) {
    next(error);
  }
});

// PUT /api/user/preferences - Update user preferences
userPreferencesRoutes.put('/preferences', async (req: Request, res: Response, next) => {
  try {
    const userId = (req as any).userId || 'default-user';
    const preferences = req.body as AudioNotificationPreferences;

    await userPreferencesService.updateUserPreferences(userId, preferences);

    // Return updated preferences
    const updated = await userPreferencesService.getUserPreferences(userId);
    sendSuccess(res, updated);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('validation')) {
        return sendError(res, `Invalid preferences: ${error.message}`, 400);
      }
      return sendError(res, error.message, 500);
    }
    next(error);
  }
});

// POST /api/user/preferences/reset - Reset to default preferences
userPreferencesRoutes.post('/preferences/reset', async (req: Request, res: Response, next) => {
  try {
    const userId = (req as any).userId || 'default-user';

    await userPreferencesService.resetToDefaults(userId);

    const defaults = await userPreferencesService.getUserPreferences(userId);
    sendSuccess(res, defaults);
  } catch (error) {
    next(error);
  }
});

// GET /api/user/preferences/defaults - Get default preferences
userPreferencesRoutes.get('/preferences/defaults', async (req: Request, res: Response) => {
  try {
    const defaults = userPreferencesService.getDefaultPreferences();
    sendSuccess(res, defaults);
  } catch (error) {
    sendError(res, 'Failed to get default preferences', 500);
  }
});
