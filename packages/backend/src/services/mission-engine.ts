import { join } from 'path';
import type { MissionMeta, MissionStatus, WorkflowStep } from '@haflow/shared';
import { missionStore } from './mission-store.js';
import { getDefaultWorkflow } from './workflow.js';
import { dockerProvider } from './docker.js';
import type { SandboxProvider } from './sandbox.js';
import { config } from '../utils/config.js';

const provider: SandboxProvider = dockerProvider;
const runningContainers: Map<string, string> = new Map(); // runId -> containerId

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
    const inputArtifact = step.inputArtifact || 'raw-input.md';
    const outputArtifact = step.outputArtifact || 'output.md';

    // TODO: Replace with actual Claude agent container
    // For v0, we use a simple "mock agent" that just copies/transforms the input
    // In production, this would be the actual Claude agent container
    const containerId = await provider.start({
      missionId,
      runId: run.run_id,
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
        `echo "Agent ${step.name} completed successfully"`
      ],
    });

    // Store container ID
    await missionStore.updateRun(missionId, run.run_id, { container_id: containerId });
    runningContainers.set(run.run_id, containerId);

    // Start monitoring the container
    monitorContainer(missionId, run.run_id, containerId);

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
