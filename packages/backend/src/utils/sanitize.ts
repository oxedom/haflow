/**
 * List of environment variable names containing sensitive values that should be redacted in logs
 */
const SENSITIVE_ENV_KEYS = [
  'CLAUDE_API_KEY',
  'GITHUB_TOKEN',
  'RALPHY_API_TOKEN',
];

/**
 * Sanitizes environment variables for safe logging by redacting sensitive values.
 * @param env - The environment variables object to sanitize
 * @returns A new object with sensitive values replaced with '<REDACTED>'
 */
export function sanitizeEnvForLogging(
  env: Record<string, string | undefined>
): Record<string, string | undefined> {
  const sanitized: Record<string, string | undefined> = {};

  for (const [key, value] of Object.entries(env)) {
    if (SENSITIVE_ENV_KEYS.includes(key) && value !== undefined) {
      sanitized[key] = '<REDACTED>';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitizes a string for use as a git branch name.
 * - Converts to lowercase
 * - Replaces spaces with hyphens
 * - Removes special characters (keeps alphanumeric and hyphens)
 * - Removes leading/trailing hyphens
 * - Collapses multiple consecutive hyphens into one
 *
 * @param name - The string to sanitize
 * @returns A sanitized string safe for use as a branch name
 */
export function sanitizeBranchName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, '') // Remove special characters
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}
