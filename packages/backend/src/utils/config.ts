import { homedir } from 'os';
import { join } from 'path';

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  haloopHome: process.env.HALOOP_HOME || join(homedir(), '.haloop'),
  get missionsDir() {
    return join(this.haloopHome, 'missions');
  },
  // Workflows live with the backend for v0
  get workflowsDir() {
    return join(process.cwd(), 'packages/backend/public/workflows');
  },
};
