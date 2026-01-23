import { mkdir, readdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { MissionMeta, MissionDetail, MissionListItem, StepRun, MissionType } from '@haflow/shared';
import { config } from '../utils/config.js';
import { generateMissionId, generateRunId } from '../utils/id.js';
import { getDefaultWorkflow, getDefaultWorkflowId, getWorkflowStepName } from './workflow.js';

const missionsDir = () => config.missionsDir;
const missionDir = (missionId: string) => join(missionsDir(), missionId);
const artifactsDir = (missionId: string) => join(missionDir(missionId), 'artifacts');
const runsDir = (missionId: string) => join(missionDir(missionId), 'runs');
const logsDir = (missionId: string) => join(missionDir(missionId), 'logs');
const metaPath = (missionId: string) => join(missionDir(missionId), 'mission.json');

async function init(): Promise<void> {
  if (!existsSync(missionsDir())) {
    await mkdir(missionsDir(), { recursive: true });
  }
}

// Ralph mode options for mission creation
interface RalphModeOptions {
  ralph_mode?: boolean;
  ralph_max_iterations?: number;
}

// --- Create ---
async function createMission(
  title: string,
  type: MissionType,
  rawInput: string,
  ralphOptions?: RalphModeOptions
): Promise<MissionMeta> {
  const missionId = generateMissionId();
  const now = new Date().toISOString();

  const meta: MissionMeta = {
    mission_id: missionId,
    title,
    type,
    workflow_id: getDefaultWorkflowId(),
    current_step: 0,
    status: 'ready',
    created_at: now,
    updated_at: now,
    errors: [],
    // Ralph mode fields
    ralph_mode: ralphOptions?.ralph_mode,
    ralph_max_iterations: ralphOptions?.ralph_max_iterations,
    ralph_current_iteration: ralphOptions?.ralph_mode ? 1 : undefined,
  };

  // Create directories
  await mkdir(missionDir(missionId), { recursive: true });
  await mkdir(artifactsDir(missionId), { recursive: true });
  await mkdir(runsDir(missionId), { recursive: true });
  await mkdir(logsDir(missionId), { recursive: true });

  // Write mission.json
  await writeFile(metaPath(missionId), JSON.stringify(meta, null, 2));

  // Write raw-input.md artifact
  await saveArtifact(missionId, 'raw-input.md', rawInput);

  return meta;
}

// --- Read ---
async function getMeta(missionId: string): Promise<MissionMeta | null> {
  const path = metaPath(missionId);
  if (!existsSync(path)) return null;
  const content = await readFile(path, 'utf-8');
  return JSON.parse(content);
}

async function getDetail(missionId: string): Promise<MissionDetail | null> {
  const meta = await getMeta(missionId);
  if (!meta) return null;

  const workflow = getDefaultWorkflow();
  const artifacts = await loadArtifacts(missionId);
  const runs = await loadRuns(missionId);
  const currentLogTail = await getCurrentLogTail(missionId, runs);

  return {
    ...meta,
    workflow,
    artifacts,
    runs,
    current_log_tail: currentLogTail,
  };
}

async function listMissions(): Promise<MissionListItem[]> {
  await init();
  const entries = await readdir(missionsDir(), { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);

  const items: MissionListItem[] = [];

  for (const missionId of dirs) {
    const meta = await getMeta(missionId);
    if (meta) {
      items.push({
        mission_id: meta.mission_id,
        title: meta.title,
        type: meta.type,
        status: meta.status,
        current_step_name: getWorkflowStepName(meta.workflow_id, meta.current_step),
        updated_at: meta.updated_at,
      });
    }
  }

  // Sort by updated_at desc
  items.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  return items;
}

// --- Update ---
async function updateMeta(missionId: string, updates: Partial<MissionMeta>): Promise<void> {
  const meta = await getMeta(missionId);
  if (!meta) throw new Error(`Mission not found: ${missionId}`);

  const updated = {
    ...meta,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  await writeFile(metaPath(missionId), JSON.stringify(updated, null, 2));
}

// --- Artifacts ---
async function loadArtifacts(missionId: string): Promise<Record<string, string>> {
  const dir = artifactsDir(missionId);
  if (!existsSync(dir)) return {};

  const files = await readdir(dir);
  const artifacts: Record<string, string> = {};

  for (const file of files) {
    const content = await readFile(join(dir, file), 'utf-8');
    artifacts[file] = content;
  }

  return artifacts;
}

async function getArtifact(missionId: string, filename: string): Promise<string | null> {
  const path = join(artifactsDir(missionId), filename);
  if (!existsSync(path)) return null;
  return readFile(path, 'utf-8');
}

async function saveArtifact(missionId: string, filename: string, content: string): Promise<void> {
  const dir = artifactsDir(missionId);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(join(dir, filename), content);
}

// --- Runs ---
async function loadRuns(missionId: string): Promise<StepRun[]> {
  const dir = runsDir(missionId);
  if (!existsSync(dir)) return [];

  const files = await readdir(dir);
  const runs: StepRun[] = [];

  for (const file of files) {
    if (file.endsWith('.json')) {
      const content = await readFile(join(dir, file), 'utf-8');
      runs.push(JSON.parse(content));
    }
  }

  // Sort by started_at
  runs.sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
  return runs;
}

async function createRun(missionId: string, stepId: string): Promise<StepRun> {
  const runId = generateRunId();
  const run: StepRun = {
    step_id: stepId,
    run_id: runId,
    started_at: new Date().toISOString(),
  };

  const dir = runsDir(missionId);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(join(dir, `${runId}.json`), JSON.stringify(run, null, 2));

  return run;
}

async function updateRun(missionId: string, runId: string, updates: Partial<StepRun>): Promise<void> {
  const path = join(runsDir(missionId), `${runId}.json`);
  const content = await readFile(path, 'utf-8');
  const run = JSON.parse(content);
  const updated = { ...run, ...updates };
  await writeFile(path, JSON.stringify(updated, null, 2));
}

// --- Logs ---
async function appendLog(missionId: string, runId: string, data: string): Promise<void> {
  const dir = logsDir(missionId);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  const path = join(dir, `${runId}.log`);

  // Append mode
  const existing = existsSync(path) ? await readFile(path, 'utf-8') : '';
  await writeFile(path, existing + data);
}

async function getLogTail(missionId: string, runId: string, bytes = 2000): Promise<string> {
  const path = join(logsDir(missionId), `${runId}.log`);
  if (!existsSync(path)) return '';

  const content = await readFile(path, 'utf-8');
  return content.slice(-bytes);
}

async function getCurrentLogTail(missionId: string, runs: StepRun[]): Promise<string | undefined> {
  // Find the most recent run without finished_at (still running)
  const runningRun = runs.find(r => !r.finished_at);
  if (!runningRun) return undefined;

  return getLogTail(missionId, runningRun.run_id);
}

export const missionStore = {
  init,
  createMission,
  getMeta,
  getDetail,
  listMissions,
  updateMeta,
  loadArtifacts,
  getArtifact,
  saveArtifact,
  loadRuns,
  createRun,
  updateRun,
  appendLog,
  getLogTail,
};
