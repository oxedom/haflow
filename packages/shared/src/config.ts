/**
 * Cross-platform configuration path resolution
 * Handles Windows, macOS, and Linux config directory conventions
 */

import { homedir } from 'os';
import { join, resolve } from 'path';

/** Application name for config directories */
const APP_NAME = 'haflow';

/**
 * Get the platform-specific configuration directory
 * - Windows: %APPDATA%\haflow
 * - macOS: ~/Library/Application Support/haflow
 * - Linux: ~/.config/haflow (respects XDG_CONFIG_HOME)
 */
export function getConfigDir(): string {
  const platform = process.platform;

  if (platform === 'win32') {
    // Windows: Use APPDATA environment variable
    const appData = process.env.APPDATA;
    if (!appData) {
      // Fallback to home directory if APPDATA is not set
      return join(homedir(), `.${APP_NAME}`);
    }
    return join(appData, APP_NAME);
  }

  if (platform === 'darwin') {
    // macOS: Use ~/Library/Application Support
    return join(homedir(), 'Library', 'Application Support', APP_NAME);
  }

  // Linux and other platforms: Use XDG_CONFIG_HOME or ~/.config
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome) {
    return join(xdgConfigHome, APP_NAME);
  }

  return join(homedir(), '.config', APP_NAME);
}

/**
 * Get the path to the project state file
 * @returns Absolute path to the state file
 */
export function getStateFilePath(): string {
  const configDir = getConfigDir();
  return join(configDir, 'project-state.json');
}

/**
 * Resolve and normalize a path to absolute form
 * @param path - Path to resolve (relative or absolute)
 * @returns Absolute path
 */
export function resolvePath(path: string): string {
  if (resolve(path) === path) {
    // Already absolute
    return path;
  }
  // Relative path - resolve relative to cwd
  return resolve(process.cwd(), path);
}
