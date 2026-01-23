import { homedir } from 'os';
import { join } from 'path';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
const HAFLOW_HOME = process.env.HAFLOW_HOME || join(homedir(), '.haflow');
const CONFIG_PATH = join(HAFLOW_HOME, 'config.json');
export const paths = {
    home: HAFLOW_HOME,
    config: CONFIG_PATH,
};
export async function ensureHome() {
    if (!existsSync(HAFLOW_HOME)) {
        await mkdir(HAFLOW_HOME, { recursive: true });
    }
}
export async function loadConfig() {
    try {
        return JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
    }
    catch {
        return {};
    }
}
export async function saveConfig(config) {
    await ensureHome();
    await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}
