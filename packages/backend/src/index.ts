import { createServer } from './server.js';
import { config } from './utils/config.js';
import { missionStore } from './services/mission-store.js';
import { missionEngine } from './services/mission-engine.js';
import { userPreferencesService } from './services/user-preferences.js';

async function main() {
  // Initialize stores and engine
  await missionStore.init();
  await missionEngine.init();
  await userPreferencesService.init();

  const app = createServer();

  app.listen(config.port, () => {
    console.log(`haflow backend listening on port ${config.port}`);
    console.log(`Missions directory: ${config.missionsDir}`);
  });
}

main().catch(console.error);
