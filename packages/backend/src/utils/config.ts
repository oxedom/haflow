import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Navigate from packages/backend/src/utils/ up to repo root
const repoRoot = join(__dirname, '..', '..', '..', '..');

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  haflowHome: process.env.HAFLOW_HOME || join(homedir(), '.haflow'),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  // Path to the haflow repo's .claude folder
  haflowClaudeDir: join(repoRoot, '.claude'),
  get missionsDir() {
    return join(this.haflowHome, 'missions');
  },
  // Workflows live with the backend for v0
  get workflowsDir() {
    return join(process.cwd(), 'packages/backend/public/workflows');
  },
};
