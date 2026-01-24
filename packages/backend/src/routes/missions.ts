import { Router, type Router as RouterType } from 'express';
import { CreateMissionRequestSchema, SaveArtifactRequestSchema } from '@haflow/shared';
import { missionStore } from '../services/mission-store.js';
import { missionEngine } from '../services/mission-engine.js';
import { getWorkflows } from '../services/workflow.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const missionRoutes: RouterType = Router();
export const workflowRoutes: RouterType = Router();

// GET /api/workflows - List all workflows
workflowRoutes.get('/', async (_req, res, next) => {
  try {
    const workflows = getWorkflows();
    sendSuccess(res, workflows);
  } catch (err) {
    next(err);
  }
});

// GET /api/missions - List all missions
missionRoutes.get('/', async (_req, res, next) => {
  try {
    const missions = await missionStore.listMissions();
    sendSuccess(res, missions);
  } catch (err) {
    next(err);
  }
});

// GET /api/missions/:missionId - Get mission detail
missionRoutes.get('/:missionId', async (req, res, next) => {
  try {
    const { missionId } = req.params;
    const detail = await missionStore.getDetail(missionId);

    if (!detail) {
      return sendError(res, `Mission not found: ${missionId}`, 404);
    }

    sendSuccess(res, detail);
  } catch (err) {
    next(err);
  }
});

// POST /api/missions - Create mission
missionRoutes.post('/', async (req, res, next) => {
  try {
    const parsed = CreateMissionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '), 400);
    }

    const { title, type, rawInput, workflowId } = parsed.data;
    const meta = await missionStore.createMission(title, type, rawInput, workflowId);
    sendSuccess(res, meta, 201);
  } catch (err) {
    next(err);
  }
});

// PUT /api/missions/:missionId/artifacts/:filename - Save artifact
missionRoutes.put('/:missionId/artifacts/:filename', async (req, res, next) => {
  try {
    const { missionId, filename } = req.params;
    const parsed = SaveArtifactRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, parsed.error.errors.map(e => e.message).join(', '), 400);
    }

    const meta = await missionStore.getMeta(missionId);
    if (!meta) {
      return sendError(res, `Mission not found: ${missionId}`, 404);
    }

    await missionStore.saveArtifact(missionId, filename, parsed.data.content);
    await missionStore.updateMeta(missionId, {}); // Touch updated_at

    sendSuccess(res, null);
  } catch (err) {
    next(err);
  }
});

// POST /api/missions/:missionId/continue - Continue mission
missionRoutes.post('/:missionId/continue', async (req, res, next) => {
  try {
    const { missionId } = req.params;

    const meta = await missionStore.getMeta(missionId);
    if (!meta) {
      return sendError(res, `Mission not found: ${missionId}`, 404);
    }

    await missionEngine.continueMission(missionId);
    sendSuccess(res, null);
  } catch (err) {
    next(err);
  }
});

// POST /api/missions/:missionId/mark-completed - Force complete
missionRoutes.post('/:missionId/mark-completed', async (req, res, next) => {
  try {
    const { missionId } = req.params;

    const meta = await missionStore.getMeta(missionId);
    if (!meta) {
      return sendError(res, `Mission not found: ${missionId}`, 404);
    }

    await missionStore.updateMeta(missionId, { status: 'completed' });
    sendSuccess(res, null);
  } catch (err) {
    next(err);
  }
});
