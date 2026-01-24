import { join } from 'path';
import type { MissionMeta, MissionStatus, WorkflowStep } from '@haflow/shared';
import { missionStore } from './mission-store.js';
import { getDefaultWorkflow, getStepPrompt } from './workflow.js';
import { dockerProvider } from './docker.js';
import type { SandboxProvider } from './sandbox.js';
import { config } from '../utils/config.js';

const provider: SandboxProvider = dockerProvider;
const runningContainers: Map<string, string> = new Map(); // runId -> containerId
const runningStreams: Map<string, AbortController> = new Map(); // runId -> abort controller

async function init(): Promise<void> {
  // Check provider availability
  const available = await provider.isAvailable();
  if (!available) {
    console.warn('Sandbox provider (Docker) not available. Agent steps will fail.');
  }

  // Cleanup orphaned containers from previous runs
  await provider.cleanupOrphaned();
}

async function continueMission(missionId: string): Promise<void> {
  const meta = await missionStore.getMeta(missionId);
  if (!meta) throw new Error(`Mission not found: ${missionId}`);

  const workflow = getDefaultWorkflow();
  const currentStep = workflow.steps[meta.current_step];

  if (!currentStep) {
    // All steps complete
    await missionStore.updateMeta(missionId, { status: 'completed' });
    return;
  }

  if (currentStep.type === 'human-gate') {
    // Human approved - advance to next step
    await advanceToNextStep(missionId, meta);
  } else if (currentStep.type === 'agent') {
    // Start agent run
    await startAgentStep(missionId, meta, currentStep);
  }
}

async function advanceToNextStep(missionId: string, meta: MissionMeta): Promise<void> {
  const workflow = getDefaultWorkflow();
  const nextStepIndex = meta.current_step + 1;
  const nextStep = workflow.steps[nextStepIndex];

  if (!nextStep) {
    // Mission complete
    await missionStore.updateMeta(missionId, {
      status: 'completed',
      current_step: nextStepIndex,
    });
    return;
  }

  // Determine new status based on next step type
  const newStatus: MissionStatus = nextStep.type === 'human-gate'
    ? 'waiting_human'
    : 'ready';

  await missionStore.updateMeta(missionId, {
    status: newStatus,
    current_step: nextStepIndex,
  });

  // If next step is an agent, start it automatically
  if (nextStep.type === 'agent') {
    await startAgentStep(missionId, { ...meta, current_step: nextStepIndex }, nextStep);
  }
}

async function startAgentStep(
  missionId: string,
  meta: MissionMeta,
  step: WorkflowStep
): Promise<void> {
  // Create run record
  const run = await missionStore.createRun(missionId, step.step_id);

  // Update mission status
  await missionStore.updateMeta(missionId, { status: 'running_code_agent' });

  try {
    // Get artifact paths
    const artifactsPath = join(config.missionsDir, missionId, 'artifacts');

    // Check if Claude streaming is available
    if (provider.startClaudeStreaming) {
      // Use Claude sandbox with streaming
      await runClaudeStreaming(missionId, meta, step, run.run_id, artifactsPath);
    } else {
      // Fallback to mock agent for testing
      await runMockAgent(missionId, meta, step, run.run_id, artifactsPath);
    }
  } catch (err) {
    // Agent failed to start
    const error = err instanceof Error ? err.message : String(err);
    await missionStore.updateRun(missionId, run.run_id, {
      finished_at: new Date().toISOString(),
      exit_code: 1,
    });
    await missionStore.updateMeta(missionId, {
      status: 'failed',
      errors: [...meta.errors, error],
      last_error: error,
    });
  }
}

// Run Claude with streaming output
async function runClaudeStreaming(
  missionId: string,
  _meta: MissionMeta,
  step: WorkflowStep,
  runId: string,
  artifactsPath: string
): Promise<void> {
  const prompt = getStepPrompt(step);

  // Create abort controller for this run
  const abortController = new AbortController();
  runningStreams.set(runId, abortController);

  let isComplete = false;
  let logBuffer = '';

  try {
    const stream = provider.startClaudeStreaming!({
      missionId,
      runId,
      stepId: step.step_id,
      artifactsPath,
      prompt,
    });

    for await (const event of stream) {
      // Append to log buffer
      if (event.text) {
        logBuffer += event.text + '\n';
        // Save logs periodically (every 500 chars)
        if (logBuffer.length > 500) {
          await missionStore.appendLog(missionId, runId, logBuffer);
          logBuffer = '';
        }
      }

      if (event.type === 'tool_use' && event.toolName) {
        const toolLog = `[Tool: ${event.toolName}]\n${event.text || ''}\n`;
        await missionStore.appendLog(missionId, runId, toolLog);
      }

      if (event.isComplete) {
        isComplete = true;
      }

      if (event.type === 'error') {
        throw new Error(event.text || 'Claude sandbox error');
      }
    }

    // Flush remaining log buffer
    if (logBuffer) {
      await missionStore.appendLog(missionId, runId, logBuffer);
    }

    // Update run record
    await missionStore.updateRun(missionId, runId, {
      finished_at: new Date().toISOString(),
      exit_code: 0,
    });

    runningStreams.delete(runId);

    // Get fresh meta to check ralph mode
    const freshMeta = await missionStore.getMeta(missionId);
    if (!freshMeta) return;

    // Handle completion
    await handleAgentCompletion(missionId, freshMeta, step, isComplete);

  } catch (err) {
    runningStreams.delete(runId);

    // Flush remaining log buffer
    if (logBuffer) {
      await missionStore.appendLog(missionId, runId, logBuffer);
    }

    const error = err instanceof Error ? err.message : String(err);
    await missionStore.updateRun(missionId, runId, {
      finished_at: new Date().toISOString(),
      exit_code: 1,
    });

    const freshMeta = await missionStore.getMeta(missionId);
    if (!freshMeta) return;

    await missionStore.updateMeta(missionId, {
      status: 'failed',
      errors: [...freshMeta.errors, error],
      last_error: error,
    });
  }
}

// Handle agent completion
async function handleAgentCompletion(
  missionId: string,
  meta: MissionMeta,
  _step: WorkflowStep,
  _isComplete: boolean
): Promise<void> {
  await advanceToNextStep(missionId, meta);
}

// Fallback mock agent for testing without Docker sandbox
async function runMockAgent(
  missionId: string,
  _meta: MissionMeta,
  step: WorkflowStep,
  runId: string,
  artifactsPath: string
): Promise<void> {
  const inputArtifact = step.inputArtifact || 'raw-input.md';
  const outputArtifact = step.outputArtifact || 'output.md';

  const containerId = await provider.start({
    missionId,
    runId,
    stepId: step.step_id,
    image: 'node:20-slim',
    artifactsPath,
    command: [
      'sh', '-c',
      // Simple mock: copy input to output with header
      `echo "# Output from ${step.name}" > /mission/artifacts/${outputArtifact} && ` +
      `echo "" >> /mission/artifacts/${outputArtifact} && ` +
      `echo "Processed by: ${step.agent || step.step_id}" >> /mission/artifacts/${outputArtifact} && ` +
      `echo "" >> /mission/artifacts/${outputArtifact} && ` +
      `cat /mission/artifacts/${inputArtifact} >> /mission/artifacts/${outputArtifact} && ` +
      `echo "<promise>COMPLETE</promise>" >> /mission/artifacts/${outputArtifact} && ` +
      `echo "Agent ${step.name} completed successfully"`
    ],
  });

  // Store container ID
  await missionStore.updateRun(missionId, runId, { container_id: containerId });
  runningContainers.set(runId, containerId);

  // Start monitoring the container
  monitorContainer(missionId, runId, containerId);
}

function monitorContainer(missionId: string, runId: string, containerId: string): void {
  const checkInterval = setInterval(async () => {
    try {
      const status = await provider.getStatus(containerId);

      // Capture logs
      const logs = await provider.getLogTail(containerId);
      if (logs) {
        await missionStore.appendLog(missionId, runId, logs);
      }

      if (status.state === 'exited') {
        clearInterval(checkInterval);
        runningContainers.delete(runId);

        // Update run record
        await missionStore.updateRun(missionId, runId, {
          finished_at: status.finishedAt || new Date().toISOString(),
          exit_code: status.exitCode,
        });

        // Clean up container (we don't use --rm to allow inspection)
        await provider.remove(containerId);

        const meta = await missionStore.getMeta(missionId);
        if (!meta) return;

        if (status.exitCode === 0) {
          // Success - advance to next step
          await advanceToNextStep(missionId, meta);
        } else {
          // Failed
          const error = `Agent exited with code ${status.exitCode}`;
          await missionStore.updateMeta(missionId, {
            status: 'failed',
            errors: [...meta.errors, error],
            last_error: error,
          });
        }
      }
    } catch (err) {
      console.error(`Error monitoring container ${containerId}:`, err);
    }
  }, 1000); // Check every second
}

async function getRunningLogTail(_missionId: string, runId: string): Promise<string | undefined> {
  const containerId = runningContainers.get(runId);
  if (!containerId) return undefined;

  return provider.getLogTail(containerId);
}

export const missionEngine = {
  init,
  continueMission,
  getRunningLogTail,
};
