import { Router, type Router as RouterType } from 'express';
import { join } from 'path';
import { existsSync } from 'fs';
import { CreateMissionRequestSchema, SaveArtifactRequestSchema } from '@haflow/shared';
import { missionStore } from '../services/mission-store.js';
import { missionEngine } from '../services/mission-engine.js';
import { getWorkflows } from '../services/workflow.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { config, execAsync, getProjectGitStatus, getFileDiff } from '../utils/config.js';
import { executeCommand, getExecution } from '../services/command-runner.js';

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

// DELETE /api/missions/:missionId - Delete mission
missionRoutes.delete('/:missionId', async (req, res, next) => {
  try {
    const { missionId } = req.params;

    const meta = await missionStore.getMeta(missionId);
    if (!meta) {
      return sendError(res, `Mission not found: ${missionId}`, 404);
    }

    await missionStore.deleteMission(missionId);
    sendSuccess(res, null);
  } catch (err) {
    next(err);
  }
});

// POST /api/missions/bulk-delete - Delete multiple missions
missionRoutes.post('/bulk-delete', async (req, res, next) => {
  try {
    const { ids, reason } = req.body;

    // Validate input
    if (!Array.isArray(ids) || ids.length === 0) {
      return sendError(res, 'ids must be a non-empty array', 400);
    }

    if (ids.length > 10000) {
      return sendError(res, 'Maximum 10000 missions can be deleted at once', 400);
    }

    const deleted: string[] = [];
    const failed: string[] = [];
    const errors: string[] = [];

    // Delete each mission
    for (const missionId of ids) {
      try {
        const meta = await missionStore.getMeta(missionId);
        if (!meta) {
          failed.push(missionId);
          errors.push(`Mission not found: ${missionId}`);
          continue;
        }

        await missionStore.deleteMission(missionId);
        deleted.push(missionId);
      } catch (err) {
        failed.push(missionId);
        errors.push(`Failed to delete ${missionId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    sendSuccess(res, {
      deleted: deleted.length,
      failed: failed.length,
      failedIds: failed.length > 0 ? failed : undefined,
      message: `Deleted ${deleted.length} of ${ids.length} missions${reason ? ` (Reason: ${reason})` : ''}`,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/missions/:missionId/git-status - Get git status of cloned project
missionRoutes.get('/:missionId/git-status', async (req, res, next) => {
  try {
    const missionId = req.params.missionId as string;

    const meta = await missionStore.getMeta(missionId);
    if (!meta) {
      return sendError(res, `Mission not found: ${missionId}`, 404);
    }

    const status = await getProjectGitStatus(missionId);
    sendSuccess(res, status);
  } catch (err) {
    next(err);
  }
});

// GET /api/missions/:missionId/git-diff/:filePath - Get file diff from cloned project
missionRoutes.get('/:missionId/git-diff/:filePath(*)', async (req, res, next) => {
  try {
    const missionId = req.params.missionId as string;
    const filePath = req.params.filePath as string;

    const meta = await missionStore.getMeta(missionId);
    if (!meta) {
      return sendError(res, `Mission not found: ${missionId}`, 404);
    }

    if (!filePath) {
      return sendError(res, 'File path is required', 400);
    }

    const clonePath = join(config.missionsDir, missionId, 'project');
    const diff = await getFileDiff(clonePath, filePath);
    sendSuccess(res, { diff });
  } catch (err) {
    next(err);
  }
});

// GET /api/missions/:missionId/git-diff - Get full diff for all changed files
missionRoutes.get('/:missionId/git-diff', async (req, res, next) => {
  try {
    const missionId = req.params.missionId as string;

    const meta = await missionStore.getMeta(missionId);
    if (!meta) {
      return sendError(res, `Mission not found: ${missionId}`, 404);
    }

    const clonePath = join(config.missionsDir, missionId, 'project');
    if (!existsSync(clonePath)) {
      return sendSuccess(res, { diff: '' });
    }

    const { stdout } = await execAsync('git diff HEAD', { cwd: clonePath });
    sendSuccess(res, { diff: stdout });
  } catch (err) {
    next(err);
  }
});

// POST /api/missions/:missionId/run-command - Execute a command in the mission's cloned project
missionRoutes.post('/:missionId/run-command', async (req, res, next) => {
  try {
    const missionId = req.params.missionId as string;
    const { command, timeout } = req.body as { command: string; timeout?: number };

    const meta = await missionStore.getMeta(missionId);
    if (!meta) {
      return sendError(res, `Mission not found: ${missionId}`, 404);
    }

    if (!command || typeof command !== 'string') {
      return sendError(res, 'Command is required', 400);
    }

    // Check if project clone exists
    const projectPath = join(config.missionsDir, missionId, 'project');
    if (!existsSync(projectPath)) {
      return sendError(res, 'No project clone exists for this mission', 400);
    }

    const executionId = await executeCommand(missionId, command, timeout);
    sendSuccess(res, { executionId });
  } catch (err) {
    next(err);
  }
});

// GET /api/missions/:missionId/execution/:executionId - Get command execution status/output
missionRoutes.get('/:missionId/execution/:executionId', async (req, res, next) => {
  try {
    const { missionId, executionId } = req.params;

    const meta = await missionStore.getMeta(missionId);
    if (!meta) {
      return sendError(res, `Mission not found: ${missionId}`, 404);
    }

    const execution = getExecution(executionId);
    if (!execution) {
      return sendError(res, `Execution not found: ${executionId}`, 404);
    }

    sendSuccess(res, execution);
  } catch (err) {
    next(err);
  }
});
