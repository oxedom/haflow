import { z } from 'zod';
import * as path from 'path';
import * as os from 'os';

/**
 * Configuration schema for the Ralphy backend server.
 * All values can be overridden via environment variables.
 */
const ConfigSchema = z.object({
  /**
   * Port to listen on.
   * @default 3000
   */
  PORT: z.coerce.number().default(3000),

  /**
   * Host to bind to.
   * @default '127.0.0.1'
   */
  HOST: z.string().default('127.0.0.1'),

  /**
   * Ralphy home directory for database and logs.
   * @default '~/.ralphy'
   */
  RALPHY_HOME: z.string().default(path.join(os.homedir(), '.ralphy')),

  /**
   * Log level for pino logger.
   * @default 'info'
   */
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  /**
   * API token for authentication.
   * If not set, all requests are allowed.
   */
  RALPHY_API_TOKEN: z.string().optional(),

  /**
   * Node environment.
   * @default 'development'
   */
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

/**
 * Configuration type inferred from the schema.
 */
export type Config = z.infer<typeof ConfigSchema>;

/**
 * Parse and validate configuration from environment variables.
 */
function loadConfig(): Config {
  return ConfigSchema.parse({
    PORT: process.env.PORT,
    HOST: process.env.HOST,
    RALPHY_HOME: process.env.RALPHY_HOME,
    LOG_LEVEL: process.env.LOG_LEVEL,
    RALPHY_API_TOKEN: process.env.RALPHY_API_TOKEN,
    NODE_ENV: process.env.NODE_ENV,
  });
}

/**
 * Validated configuration object.
 * Loaded once at startup from environment variables.
 */
export const config = loadConfig();

/**
 * Re-export the schema for external use (e.g., testing).
 */
export { ConfigSchema };
