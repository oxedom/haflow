import { Router, type Router as RouterType } from 'express';
import { join } from 'path';
import { existsSync } from 'fs';
import { CreateMissionRequestSchema, SaveArtifactRequestSchema } from '@haflow/shared';
import { missionStore } from '../services/mission-store.js';
import { missionEngine } from '../services/mission-engine.js';
import { dockerProvider } from '../services/docker.js';
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

// GET /api/workflows/templates - Alias for listing workflows
workflowRoutes.get('/templates', async (_req, res, next) => {
  try {
    const workflows = getWorkflows();
    sendSuccess(res, workflows);
  } catch (err) {
    next(err);
  }
});

// POST /api/workflows/execute - Validate and execute a workflow
workflowRoutes.post('/execute', async (req, res, next) => {
  try {
    const { workflowId, workflow } = req.body;

    // Must provide either workflowId or workflow
    if (!workflowId && !workflow) {
      return sendError(res, 'workflowId or workflow required', 400);
    }

    let resolvedWorkflow;

    if (workflowId) {
      // Look up template workflow by ID
      const workflows = getWorkflows();
      resolvedWorkflow = workflows.find(w => w.workflow_id === workflowId);
      if (!resolvedWorkflow) {
        return sendError(res, `Workflow not found: ${workflowId}`, 404);
      }
    } else {
      // Use provided dynamic workflow
      resolvedWorkflow = workflow;
    }

    // Validate workflow has at least one step
    if (!resolvedWorkflow.steps || resolvedWorkflow.steps.length === 0) {
      return sendError(res, 'Workflow must have at least one step', 400);
    }

    // Validate agent steps have agent type
    for (const step of resolvedWorkflow.steps) {
      if (step.type === 'agent' && !step.agent) {
        return sendError(res, `Step "${step.name}" is type "agent" but missing agent type`, 400);
      }
    }

    sendSuccess(res, {
      workflow_id: resolvedWorkflow.workflow_id,
      steps_count: resolvedWorkflow.steps.length,
    });
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

// DELETE /api/missions - Delete ALL missions
missionRoutes.delete('/', async (_req, res, next) => {
  try {
    // First cleanup all haflow containers
    await dockerProvider.cleanupOrphaned();
    
    // Then delete all mission directories
    const deletedCount = await missionStore.deleteAllMissions();
    sendSuccess(res, { deleted: deletedCount, message: `Deleted ${deletedCount} mission(s)` });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/missions/:missionId - Delete mission and its containers
missionRoutes.delete('/:missionId', async (req, res, next) => {
  try {
    const { missionId } = req.params;

    const meta = await missionStore.getMeta(missionId);
    if (!meta) {
      return sendError(res, `Mission not found: ${missionId}`, 404);
    }

    // First cleanup containers associated with this mission
    await dockerProvider.removeByMissionId(missionId);
    
    // Then delete the mission directory
    await missionStore.deleteMission(missionId);
    sendSuccess(res, null);
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
