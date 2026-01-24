import { homedir } from 'os';
import { join } from 'path';

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  haflowHome: process.env.HAFLOW_HOME || join(homedir(), '.haflow'),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  get missionsDir() {
    return join(this.haflowHome, 'missions');
  },
  // Workflows live with the backend for v0
  get workflowsDir() {
    return join(process.cwd(), 'packages/backend/public/workflows');
  },
};
