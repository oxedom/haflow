import { MissionState, ProcessStatus } from '@ralphy/shared';
import { MissionRepository, Mission } from '../database/repositories/missions';
import { ProcessRepository, Process } from '../database/repositories/processes';
import { AuditRepository } from '../database/repositories/audit';
import { getDockerManager, DockerManager } from './docker-manager';
import { getLogManager, LogManager } from './log-manager';
import { getSSEManager, SSEManager } from './sse-manager';

/**
 * Running states that indicate a mission needs recovery check
 */
const RUNNING_STATES: MissionState[] = [
  MissionState.GENERATING_PRD,
  MissionState.PREPARING_TASKS,
  MissionState.IN_PROGRESS,
];

/**
 * Recovery result for a single mission
 */
export interface MissionRecoveryResult {
  missionId: string;
  action: 'reattached' | 'marked_failed' | 'skipped';
  details: string;
}

/**
 * Run recovery on startup.
 * Checks missions in running states and either reattaches to running containers
 * or marks them as failed if containers are not found.
 *
 * @param missionRepo - Optional MissionRepository instance (for testing)
 * @param processRepo - Optional ProcessRepository instance (for testing)
 * @param auditRepo - Optional AuditRepository instance (for testing)
 * @param dockerManager - Optional DockerManager instance (for testing)
 * @param logManager - Optional LogManager instance (for testing)
 * @param sseManager - Optional SSEManager instance (for testing)
 * @returns Array of recovery results for each processed mission
 */
export async function runRecovery(
  missionRepo?: MissionRepository,
  processRepo?: ProcessRepository,
  auditRepo?: AuditRepository,
  dockerManager?: DockerManager,
  logManager?: LogManager,
  sseManager?: SSEManager
): Promise<MissionRecoveryResult[]> {
  const missions = missionRepo || new MissionRepository();
  const processes = processRepo || new ProcessRepository();
  const audit = auditRepo || new AuditRepository();
  const docker = dockerManager || getDockerManager();
  const logs = logManager || getLogManager();
  const sse = sseManager || getSSEManager();

  const results: MissionRecoveryResult[] = [];

  // Query missions in running states
  // SELECT * FROM missions WHERE state IN ('generating_prd', 'preparing_tasks', 'in_progress')
  const runningMissions = missions.findByStates(RUNNING_STATES);

  for (const mission of runningMissions) {
    try {
      const result = await recoverMission(
        mission,
        processes,
        audit,
        docker,
        logs,
        sse,
        missions
      );
      results.push(result);
    } catch (err) {
      // Log error but continue with other missions
      console.error(`Recovery failed for mission ${mission.id}:`, err);
      results.push({
        missionId: mission.id,
        action: 'marked_failed',
        details: `Recovery error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // Clean up orphaned containers (containers with no DB record)
  await cleanupOrphanedContainers(docker, processes, audit);

  return results;
}

/**
 * Recover a single mission
 */
async function recoverMission(
  mission: Mission,
  processRepo: ProcessRepository,
  auditRepo: AuditRepository,
  dockerManager: DockerManager,
  logManager: LogManager,
  sseManager: SSEManager,
  missionRepo: MissionRepository
): Promise<MissionRecoveryResult> {
  // Get associated processes with status='running'
  const missionProcesses = processRepo.findByMission(mission.id);
  const runningProcesses = missionProcesses.filter(
    (p) => p.status === ProcessStatus.RUNNING
  );

  if (runningProcesses.length === 0) {
    // No running processes found, mark mission as failed
    missionRepo.update(mission.id, {
      failure_reason: 'No running processes found during recovery',
      ended_at: new Date().toISOString(),
    });

    // Use direct state update to bypass validation (recovery is special case)
    try {
      missionRepo.updateState(mission.id, MissionState.COMPLETED_FAILED);
    } catch {
      // State transition may not be valid from current state, force it via direct update
      forceUpdateMissionState(missionRepo, mission.id, MissionState.COMPLETED_FAILED);
    }

    auditRepo.log('recovery.mission_marked_failed', 'mission', mission.id, {
      reason: 'No running processes',
    });

    return {
      missionId: mission.id,
      action: 'marked_failed',
      details: 'No running processes found',
    };
  }

  // Check each running process
  let anyReattached = false;
  let allFailed = true;

  for (const process of runningProcesses) {
    const recovered = await recoverProcess(
      process,
      processRepo,
      auditRepo,
      dockerManager,
      logManager,
      sseManager
    );

    if (recovered) {
      anyReattached = true;
      allFailed = false;
    }
  }

  if (anyReattached) {
    auditRepo.log('recovery.mission_reattached', 'mission', mission.id);
    return {
      missionId: mission.id,
      action: 'reattached',
      details: 'Container logs reattached',
    };
  }

  if (allFailed) {
    // All processes failed, mark mission as failed
    missionRepo.update(mission.id, {
      failure_reason: 'All processes dead during recovery',
      ended_at: new Date().toISOString(),
    });

    try {
      missionRepo.updateState(mission.id, MissionState.COMPLETED_FAILED);
    } catch {
      forceUpdateMissionState(missionRepo, mission.id, MissionState.COMPLETED_FAILED);
    }

    auditRepo.log('recovery.mission_marked_failed', 'mission', mission.id, {
      reason: 'All processes dead',
    });

    return {
      missionId: mission.id,
      action: 'marked_failed',
      details: 'All processes dead',
    };
  }

  return {
    missionId: mission.id,
    action: 'skipped',
    details: 'No action needed',
  };
}

/**
 * Recover a single process
 * Returns true if the process was successfully reattached
 */
async function recoverProcess(
  process: Process,
  processRepo: ProcessRepository,
  auditRepo: AuditRepository,
  dockerManager: DockerManager,
  logManager: LogManager,
  sseManager: SSEManager
): Promise<boolean> {
  // If container_id exists, try to reattach
  if (process.container_id) {
    try {
      // Call docker.getContainer(id).inspect()
      const info = await dockerManager.inspect(process.container_id);

      if (info.State?.Running) {
        // Container is running, reattach logs
        const logStream = await dockerManager.attachLogs(process.container_id);

        // Set up log handling
        logStream.on('data', (data: Buffer) => {
          const dataStr = data.toString();
          logManager.write(process.id, dataStr);

          // Broadcast to SSE clients
          const eventId = sseManager.getNextEventId(process.id);
          sseManager.broadcast(process.id, eventId, {
            type: 'output',
            data: dataStr,
          });
        });

        auditRepo.log('recovery.process_reattached', 'process', process.id, {
          containerId: process.container_id,
        });

        return true;
      } else {
        // Container exited, mark process as failed
        const exitCode = info.State?.ExitCode ?? -1;
        processRepo.updateStatus(process.id, ProcessStatus.ERROR, exitCode);

        auditRepo.log('recovery.process_marked_failed', 'process', process.id, {
          containerId: process.container_id,
          reason: 'Container exited',
          exitCode,
        });

        return false;
      }
    } catch (err) {
      // Container not found, mark process as failed
      processRepo.updateStatus(process.id, ProcessStatus.ERROR);

      auditRepo.log('recovery.process_marked_failed', 'process', process.id, {
        containerId: process.container_id,
        reason: 'Container not found',
        error: err instanceof Error ? err.message : String(err),
      });

      return false;
    }
  } else {
    // No container ID - this was a local process
    // Local processes cannot be reattached after restart, mark as failed
    processRepo.updateStatus(process.id, ProcessStatus.ERROR);

    auditRepo.log('recovery.process_marked_failed', 'process', process.id, {
      reason: 'Local process cannot be recovered',
    });

    return false;
  }
}

/**
 * Clean up orphaned containers (containers with no DB record)
 */
async function cleanupOrphanedContainers(
  dockerManager: DockerManager,
  processRepo: ProcessRepository,
  auditRepo: AuditRepository
): Promise<void> {
  try {
    // List all Ralphy-managed containers
    const containers = await dockerManager.listManagedContainers();

    for (const containerInfo of containers) {
      const containerId = containerInfo.Id;

      // Check if there's a corresponding process record
      const process = processRepo.findByContainerId(containerId);

      if (!process) {
        // Orphaned container - no DB record
        // Stop and remove it
        try {
          await dockerManager.stop(containerId, 5);
          await dockerManager.remove(containerId, true);

          auditRepo.log('recovery.orphaned_container_removed', 'container', containerId);
        } catch {
          // Best effort cleanup
        }
      }
    }
  } catch {
    // Docker may not be available, skip orphan cleanup
  }
}

/**
 * Force update mission state (bypass state transition validation)
 * Used during recovery when we need to mark failed missions
 */
function forceUpdateMissionState(
  missionRepo: MissionRepository,
  missionId: string,
  newState: MissionState
): void {
  // Access the database directly to bypass validation
  // This is a recovery-only operation
  const db = (missionRepo as unknown as { db: { prepare: (sql: string) => { run: (...args: unknown[]) => void } } }).db;
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    UPDATE missions
    SET state = ?, updated_at = ?
    WHERE id = ?
  `);

  stmt.run(newState, now, missionId);
}
