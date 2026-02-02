import { mkdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { AudioNotificationPreferences } from '@haflow/shared';
import { AudioNotificationPreferencesSchema } from '@haflow/shared';
import { config } from '../utils/config.js';

const preferencesDir = () => {
  const dir = join(config.haflowHome, 'user-preferences');
  return dir;
};

const preferenceFile = (userId: string) => join(preferencesDir(), `${userId}.json`);

// Default preferences for new users
const getDefaultPreferences = (): AudioNotificationPreferences => ({
  audioNotifications: {
    enabled: false,
    volume: 50,
    profiles: {
      highPriority: { sound: 'alert-urgent.wav', enabled: true },
      standardPriority: { sound: 'alert-standard.wav', enabled: true },
      lowPriority: { sound: 'alert-low.wav', enabled: false },
    },
  },
  visualNotifications: {
    enabled: true,
  },
});

async function init(): Promise<void> {
  const dir = preferencesDir();
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

async function getUserPreferences(userId: string): Promise<AudioNotificationPreferences> {
  try {
    const path = preferenceFile(userId);

    if (!existsSync(path)) {
      // Return default preferences for new users
      return getDefaultPreferences();
    }

    const content = await readFile(path, 'utf-8');
    const parsed = JSON.parse(content);

    // Validate against schema
    return AudioNotificationPreferencesSchema.parse(parsed);
  } catch (error) {
    console.error(`Failed to load preferences for user ${userId}:`, error);
    return getDefaultPreferences();
  }
}

async function updateUserPreferences(
  userId: string,
  preferences: AudioNotificationPreferences
): Promise<void> {
  try {
    // Validate schema
    const validated = AudioNotificationPreferencesSchema.parse(preferences);

    const path = preferenceFile(userId);
    const dir = preferencesDir();

    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    // Write preferences file
    await writeFile(path, JSON.stringify(validated, null, 2));
  } catch (error) {
    throw new Error(`Failed to update preferences for user ${userId}: ${error}`);
  }
}

async function resetToDefaults(userId: string): Promise<void> {
  const defaults = getDefaultPreferences();
  await updateUserPreferences(userId, defaults);
}

export const userPreferencesService = {
  init,
  getUserPreferences,
  updateUserPreferences,
  resetToDefaults,
  getDefaultPreferences,
};
