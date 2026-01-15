import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a prefixed unique identifier.
 * @param prefix - The prefix to prepend (e.g., 'proj', 'mission', 'task')
 * @returns A string in the format `{prefix}_{uuid}`
 */
export function generateId(prefix: string): string {
  return `${prefix}_${uuidv4()}`;
}
