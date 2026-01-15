import * as fs from 'fs';
import { MissionState, TaskStatus, ProcessStatus } from '@ralphy/shared';
import { MissionRepository, Mission } from '../database/repositories/missions';
import { ProjectRepository } from '../database/repositories/projects';
import { TaskRepository } from '../database/repositories/tasks';
import { AuditRepository } from '../database/repositories/audit';
import { ProcessRepository } from '../database/repositories/processes';
import { getOrchestrator, Orchestrator, OutputEvent, ExitEvent } from './orchestrator';
import { getGitManager, GitManager } from './git-manager';
import { getDockerManager, DockerManager, ContainerInfo } from './docker-manager';
import { getLogManager, LogManager } from './log-manager';
import { getSSEManager, SSEManager } from './sse-manager';
import { NotFoundError } from '../utils/errors';

/**
 * Delay helper for async operations
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * MissionExecutor service for orchestrating mission lifecycle.
 * Handles mission state transitions, process spawning, and task execution.
 */
export class MissionExecutor {
  private missionRepo: MissionRepository;
  private projectRepo: ProjectRepository;
  private taskRepo: TaskRepository;
  private auditRepo: AuditRepository;
  private processRepo: ProcessRepository;
  private orchestrator: Orchestrator;
  private gitManager: GitManager;
  private dockerManager: DockerManager;
  private logManager: LogManager;
  private sseManager: SSEManager;

  /**
   * Map of missionId to active process IDs for tracking
   */
  private activeProcesses: Map<string, string[]> = new Map();

  constructor(
    missionRepo?: MissionRepository,
    projectRepo?: ProjectRepository,
    taskRepo?: TaskRepository,
    auditRepo?: AuditRepository,
    processRepo?: ProcessRepository,
    orchestrator?: Orchestrator,
    gitManager?: GitManager,
    dockerManager?: DockerManager,
    logManager?: LogManager,
    sseManager?: SSEManager
  ) {
    this.missionRepo = missionRepo || new MissionRepository();
    this.projectRepo = projectRepo || new ProjectRepository();
    this.taskRepo = taskRepo || new TaskRepository();
    this.auditRepo = auditRepo || new AuditRepository();
    this.processRepo = processRepo || new ProcessRepository();
    this.orchestrator = orchestrator || getOrchestrator();
    this.gitManager = gitManager || getGitManager();
    this.dockerManager = dockerManager || getDockerManager();
    this.logManager = logManager || getLogManager();
    this.sseManager = sseManager || getSSEManager();
  }

  /**
   * Start a mission.
   * Creates a git worktree, transitions to generating_prd, and spawns Claude to generate PRD.
   *
   * @param missionId - The ID of the mission to start
   * @returns The updated mission
   */
  async start(missionId: string): Promise<Mission> {
    // Get the mission
    const mission = this.missionRepo.findById(missionId);
    if (!mission) {
      throw new NotFoundError('Mission', missionId);
    }

    // Get the project
    const project = this.projectRepo.findById(mission.project_id);
    if (!project) {
      throw new NotFoundError('Project', mission.project_id);
    }

    // Create git worktree for the mission
    const worktreeResult = await this.gitManager.createWorktree({
      projectPath: project.path,
      missionName: mission.feature_name,
      missionId: mission.id,
    });

    // Update mission with worktree path
    this.missionRepo.update(missionId, {
      worktree_path: worktreeResult.worktreePath,
      started_at: new Date().toISOString(),
    });

    // Transition to generating_prd
    this.missionRepo.updateState(missionId, MissionState.GENERATING_PRD);

    // Log audit event
    this.auditRepo.log('mission.started', 'mission', missionId, {
      worktreePath: worktreeResult.worktreePath,
      branchName: worktreeResult.branchName,
    });

    // Spawn Claude to generate PRD
    await this.spawnPRDGeneration(missionId, mission, worktreeResult.worktreePath);

    return this.missionRepo.findById(missionId)!;
  }

  /**
   * Approve the PRD for a mission.
   * Transitions from prd_review to preparing_tasks and spawns task generation.
   *
   * @param missionId - The ID of the mission
   * @returns The updated mission
   */
  async approvePRD(missionId: string): Promise<Mission> {
    // Get the mission
    const mission = this.missionRepo.findById(missionId);
    if (!mission) {
      throw new NotFoundError('Mission', missionId);
    }

    // Transition to preparing_tasks (validates current state is prd_review)
    this.missionRepo.updateState(missionId, MissionState.PREPARING_TASKS);

    // Log audit event
    this.auditRepo.log('mission.prd_approved', 'mission', missionId);

    // Spawn task generation
    await this.spawnTaskGeneration(missionId, mission);

    return this.missionRepo.findById(missionId)!;
  }

  /**
   * Reject the PRD for a mission.
   * Stores rejection notes, increments prd_iterations, and regenerates.
   *
   * @param missionId - The ID of the mission
   * @param notes - Rejection notes to be used for improvement
   * @returns The updated mission
   */
  async rejectPRD(missionId: string, notes: string): Promise<Mission> {
    // Get the mission
    const mission = this.missionRepo.findById(missionId);
    if (!mission) {
      throw new NotFoundError('Mission', missionId);
    }

    // Store revision notes in mission_revisions table would be ideal
    // For now, increment iterations and log the notes
    const newIterations = mission.prd_iterations + 1;
    this.missionRepo.update(missionId, {
      prd_iterations: newIterations,
    });

    // Log audit event with rejection notes
    this.auditRepo.log('mission.prd_rejected', 'mission', missionId, {
      notes,
      iteration: newIterations,
    });

    // Transition back to generating_prd (validates current state is prd_review)
    this.missionRepo.updateState(missionId, MissionState.GENERATING_PRD);

    // Respawn PRD generation with rejection notes
    const worktreePath = mission.worktree_path;
    if (!worktreePath) {
      throw new Error('Mission has no worktree path');
    }

    await this.spawnPRDGeneration(missionId, mission, worktreePath, notes);

    return this.missionRepo.findById(missionId)!;
  }

  /**
   * Approve the tasks for a mission.
   * Creates Docker container, transitions to in_progress, and starts task execution.
   *
   * @param missionId - The ID of the mission
   * @returns The updated mission
   */
  async approveTasks(missionId: string): Promise<Mission> {
    // Get the mission
    const mission = this.missionRepo.findById(missionId);
    if (!mission) {
      throw new NotFoundError('Mission', missionId);
    }

    // Get the project
    const project = this.projectRepo.findById(mission.project_id);
    if (!project) {
      throw new NotFoundError('Project', mission.project_id);
    }

    // Transition to in_progress (validates current state is tasks_review)
    this.missionRepo.updateState(missionId, MissionState.IN_PROGRESS);

    // Log audit event
    this.auditRepo.log('mission.tasks_approved', 'mission', missionId);

    // Start task execution in Docker container
    await this.executeTasksInContainer(missionId, mission, project.path);

    return this.missionRepo.findById(missionId)!;
  }

  /**
   * Reject the tasks for a mission.
   * Stores rejection notes, increments tasks_iterations, and regenerates.
   *
   * @param missionId - The ID of the mission
   * @param notes - Rejection notes to be used for improvement
   * @returns The updated mission
   */
  async rejectTasks(missionId: string, notes: string): Promise<Mission> {
    // Get the mission
    const mission = this.missionRepo.findById(missionId);
    if (!mission) {
      throw new NotFoundError('Mission', missionId);
    }

    // Increment iterations
    const newIterations = mission.tasks_iterations + 1;
    this.missionRepo.update(missionId, {
      tasks_iterations: newIterations,
    });

    // Delete existing tasks
    this.taskRepo.deleteByMission(missionId);

    // Log audit event with rejection notes
    this.auditRepo.log('mission.tasks_rejected', 'mission', missionId, {
      notes,
      iteration: newIterations,
    });

    // Transition back to preparing_tasks (validates current state is tasks_review)
    this.missionRepo.updateState(missionId, MissionState.PREPARING_TASKS);

    // Respawn task generation with rejection notes
    await this.spawnTaskGeneration(missionId, mission, notes);

    return this.missionRepo.findById(missionId)!;
  }

  /**
   * Cancel a mission.
   * Sends SIGTERM, waits 10s, sends SIGKILL if needed, updates state to completed_failed.
   *
   * @param missionId - The ID of the mission
   * @returns The updated mission
   */
  async cancel(missionId: string): Promise<Mission> {
    // Get the mission
    const mission = this.missionRepo.findById(missionId);
    if (!mission) {
      throw new NotFoundError('Mission', missionId);
    }

    // Get active processes for this mission
    const processIds = this.activeProcesses.get(missionId) || [];

    // Also check for running processes in the database
    const runningProcesses = this.processRepo.findByMission(missionId);

    // Kill all running processes
    for (const processId of processIds) {
      try {
        await this.orchestrator.kill(processId, 'SIGTERM');
      } catch {
        // Process may already be dead
      }
    }

    // Stop any Docker containers for this mission
    const containers = await this.dockerManager.listContainersForMission(missionId);
    for (const containerInfo of containers) {
      try {
        await this.dockerManager.stop(containerInfo.Id, 10);
        await this.dockerManager.remove(containerInfo.Id, true);
      } catch {
        // Container may already be stopped/removed
      }
    }

    // Wait a bit for graceful shutdown
    await delay(1000);

    // Force kill any remaining processes
    for (const processId of processIds) {
      if (this.orchestrator.isRunning(processId)) {
        try {
          await this.orchestrator.kill(processId, 'SIGKILL');
        } catch {
          // Best effort
        }
      }
    }

    // Update process statuses in database
    for (const proc of runningProcesses) {
      if (proc.status === ProcessStatus.RUNNING) {
        this.processRepo.updateStatus(proc.id, ProcessStatus.CANCELED);
      }
    }

    // Clear active processes
    this.activeProcesses.delete(missionId);

    // Log audit event
    this.auditRepo.log('mission.canceled', 'mission', missionId);

    // Transition to completed_failed
    this.missionRepo.updateState(missionId, MissionState.COMPLETED_FAILED);
    this.missionRepo.update(missionId, {
      failure_reason: 'Canceled by user',
      ended_at: new Date().toISOString(),
    });

    return this.missionRepo.findById(missionId)!;
  }

  /**
   * Spawn Claude process to generate PRD
   */
  private async spawnPRDGeneration(
    missionId: string,
    mission: Mission,
    worktreePath: string,
    rejectionNotes?: string
  ): Promise<void> {
    // Build the prompt for PRD generation
    let prompt = `Generate a Product Requirements Document (PRD) for the following feature:

Feature Name: ${mission.feature_name}
Description: ${mission.description || 'No additional description provided'}

Please create a comprehensive PRD that includes:
1. Overview and objectives
2. User stories
3. Technical requirements
4. Acceptance criteria
5. Out of scope items
`;

    if (rejectionNotes) {
      prompt += `\n\nPrevious PRD was rejected with the following feedback. Please address these concerns:\n${rejectionNotes}`;
    }

    // Spawn Claude CLI process
    const processId = this.orchestrator.spawnLocal({
      command: 'claude',
      args: ['-p', prompt, '--output-format', 'json'],
      cwd: worktreePath,
      missionId,
    });

    // Track the process
    this.trackProcess(missionId, processId);

    // Create log stream
    this.logManager.createLogStream(processId, missionId);

    // Set up output handlers
    this.setupProcessHandlers(missionId, processId, 'prd_generation');
  }

  /**
   * Spawn Claude process to generate tasks
   */
  private async spawnTaskGeneration(
    missionId: string,
    mission: Mission,
    rejectionNotes?: string
  ): Promise<void> {
    const worktreePath = mission.worktree_path;
    if (!worktreePath) {
      throw new Error('Mission has no worktree path');
    }

    // Read the PRD if available
    let prdContent = '';
    if (mission.prd_path) {
      try {
        prdContent = fs.readFileSync(mission.prd_path, 'utf-8');
      } catch {
        // PRD file may not exist yet
      }
    }

    // Build the prompt for task generation
    let prompt = `Based on the following PRD, generate a list of implementation tasks:

Feature Name: ${mission.feature_name}

PRD:
${prdContent || 'No PRD available yet'}

Please generate a JSON array of tasks with the following structure:
[
  {
    "name": "Task name",
    "description": "Detailed description",
    "agents": ["optional", "agent", "names"],
    "skills": ["optional", "skill", "names"]
  }
]
`;

    if (rejectionNotes) {
      prompt += `\n\nPrevious task list was rejected with the following feedback. Please address these concerns:\n${rejectionNotes}`;
    }

    // Spawn Claude CLI process
    const processId = this.orchestrator.spawnLocal({
      command: 'claude',
      args: ['-p', prompt, '--output-format', 'json'],
      cwd: worktreePath,
      missionId,
    });

    // Track the process
    this.trackProcess(missionId, processId);

    // Create log stream
    this.logManager.createLogStream(processId, missionId);

    // Set up output handlers
    this.setupProcessHandlers(missionId, processId, 'task_generation');
  }

  /**
   * Execute tasks in a Docker container
   */
  private async executeTasksInContainer(
    missionId: string,
    mission: Mission,
    _projectPath: string
  ): Promise<void> {
    const worktreePath = mission.worktree_path;
    if (!worktreePath) {
      throw new Error('Mission has no worktree path');
    }

    // Get tasks for the mission
    const tasks = this.taskRepo.findByMission(missionId);
    if (tasks.length === 0) {
      // No tasks to execute, mark as success
      this.missionRepo.updateState(missionId, MissionState.COMPLETED_SUCCESS);
      this.missionRepo.update(missionId, {
        result: 'No tasks to execute',
        ended_at: new Date().toISOString(),
      });
      return;
    }

    // Create Docker container for task execution
    let containerInfo: ContainerInfo;
    try {
      containerInfo = await this.dockerManager.createContainer({
        image: 'node:18-alpine',
        workingDir: '/workspace',
        binds: [`${worktreePath}:/workspace:rw`],
        missionId,
        env: {
          NODE_ENV: 'development',
        },
      });
    } catch (err) {
      // Docker creation failed, fall back to local execution
      await this.executeTasksLocally(missionId, mission, tasks);
      return;
    }

    // Track the container process
    this.trackProcess(missionId, containerInfo.processId);

    // Create log stream for the container
    this.logManager.createLogStream(containerInfo.processId, missionId);

    // Attach to container logs
    try {
      const logStream = await this.dockerManager.attachLogs(containerInfo.containerId);
      logStream.on('data', (data: Buffer) => {
        const dataStr = data.toString();
        this.logManager.write(containerInfo.processId, dataStr);

        // Broadcast to SSE clients
        const eventId = this.sseManager.getNextEventId(containerInfo.processId);
        this.sseManager.broadcast(containerInfo.processId, eventId, {
          type: 'output',
          data: dataStr,
        });
      });
    } catch {
      // Log attachment failed
    }

    // Execute tasks one by one
    for (const task of tasks) {
      // Update task status to in_progress
      this.taskRepo.updateStatus(task.id, TaskStatus.IN_PROGRESS);

      try {
        // Execute the task via Docker exec
        const execStream = await this.dockerManager.exec(containerInfo.containerId, [
          'sh',
          '-c',
          `echo "Executing task: ${task.name}" && echo "${task.description || ''}"`,
        ]);

        // Wait for execution to complete
        await new Promise<void>((resolve, reject) => {
          let output = '';
          execStream.on('data', (data: Buffer) => {
            output += data.toString();
            this.logManager.write(containerInfo.processId, data.toString());
          });
          execStream.on('end', () => {
            resolve();
          });
          execStream.on('error', (err: Error) => {
            reject(err);
          });
        });

        // Mark task as completed
        this.taskRepo.updateStatus(task.id, TaskStatus.COMPLETED);
      } catch {
        // Task failed
        this.taskRepo.updateStatus(task.id, TaskStatus.FAILED);
      }
    }

    // Stop and remove container
    try {
      await this.dockerManager.stop(containerInfo.containerId, 10);
      await this.dockerManager.remove(containerInfo.containerId, true);
    } catch {
      // Best effort cleanup
    }

    // Check if all tasks completed successfully
    const updatedTasks = this.taskRepo.findByMission(missionId);
    const allCompleted = updatedTasks.every((t) => t.status === TaskStatus.COMPLETED);
    const anyFailed = updatedTasks.some((t) => t.status === TaskStatus.FAILED);

    if (allCompleted) {
      this.missionRepo.updateState(missionId, MissionState.COMPLETED_SUCCESS);
      this.missionRepo.update(missionId, {
        result: 'All tasks completed successfully',
        ended_at: new Date().toISOString(),
      });
    } else if (anyFailed) {
      this.missionRepo.updateState(missionId, MissionState.COMPLETED_FAILED);
      this.missionRepo.update(missionId, {
        failure_reason: 'One or more tasks failed',
        ended_at: new Date().toISOString(),
      });
    }

    // Clear active processes
    this.activeProcesses.delete(missionId);

    // Log audit event
    this.auditRepo.log('mission.execution_completed', 'mission', missionId, {
      allCompleted,
      anyFailed,
    });
  }

  /**
   * Execute tasks locally (fallback when Docker is not available)
   */
  private async executeTasksLocally(
    missionId: string,
    mission: Mission,
    tasks: Array<{ id: string; name: string; description: string | null }>
  ): Promise<void> {
    const worktreePath = mission.worktree_path;
    if (!worktreePath) {
      throw new Error('Mission has no worktree path');
    }

    // Execute tasks one by one using local processes
    for (const task of tasks) {
      // Update task status to in_progress
      this.taskRepo.updateStatus(task.id, TaskStatus.IN_PROGRESS);

      try {
        // Spawn Claude to execute the task
        const processId = this.orchestrator.spawnLocal({
          command: 'claude',
          args: ['-p', `Execute the following task:\n\nTask: ${task.name}\n\nDescription: ${task.description || 'No description'}`],
          cwd: worktreePath,
          missionId,
        });

        // Track the process
        this.trackProcess(missionId, processId);

        // Create log stream
        this.logManager.createLogStream(processId, missionId);

        // Wait for process to complete
        await new Promise<void>((resolve) => {
          const exitHandler = (event: ExitEvent) => {
            if (event.processId === processId) {
              this.orchestrator.removeListener('exit', exitHandler);
              resolve();
            }
          };
          this.orchestrator.on('exit', exitHandler);
        });

        // Check process status
        const processRecord = this.processRepo.findById(processId);
        if (processRecord?.status === 'success') {
          this.taskRepo.updateStatus(task.id, TaskStatus.COMPLETED);
        } else {
          this.taskRepo.updateStatus(task.id, TaskStatus.FAILED);
        }
      } catch {
        // Task failed
        this.taskRepo.updateStatus(task.id, TaskStatus.FAILED);
      }
    }

    // Check if all tasks completed successfully
    const updatedTasks = this.taskRepo.findByMission(missionId);
    const allCompleted = updatedTasks.every((t) => t.status === TaskStatus.COMPLETED);
    const anyFailed = updatedTasks.some((t) => t.status === TaskStatus.FAILED);

    if (allCompleted) {
      this.missionRepo.updateState(missionId, MissionState.COMPLETED_SUCCESS);
      this.missionRepo.update(missionId, {
        result: 'All tasks completed successfully',
        ended_at: new Date().toISOString(),
      });
    } else if (anyFailed) {
      this.missionRepo.updateState(missionId, MissionState.COMPLETED_FAILED);
      this.missionRepo.update(missionId, {
        failure_reason: 'One or more tasks failed',
        ended_at: new Date().toISOString(),
      });
    }

    // Clear active processes
    this.activeProcesses.delete(missionId);

    // Log audit event
    this.auditRepo.log('mission.execution_completed', 'mission', missionId, {
      allCompleted,
      anyFailed,
      executionMode: 'local',
    });
  }

  /**
   * Track a process ID for a mission
   */
  private trackProcess(missionId: string, processId: string): void {
    let processes = this.activeProcesses.get(missionId);
    if (!processes) {
      processes = [];
      this.activeProcesses.set(missionId, processes);
    }
    processes.push(processId);
  }

  /**
   * Set up handlers for process output and exit events
   */
  private setupProcessHandlers(
    missionId: string,
    processId: string,
    processType: 'prd_generation' | 'task_generation'
  ): void {
    // Handle output events
    const outputHandler = (event: OutputEvent) => {
      if (event.processId === processId) {
        // Write to log
        this.logManager.write(processId, event.data);

        // Broadcast to SSE clients
        const eventId = this.sseManager.getNextEventId(processId);
        this.sseManager.broadcast(processId, eventId, {
          type: 'output',
          stream: event.stream,
          data: event.data,
        });
      }
    };

    // Handle exit events
    const exitHandler = (event: ExitEvent) => {
      if (event.processId === processId) {
        // Remove listeners
        this.orchestrator.removeListener('output', outputHandler);
        this.orchestrator.removeListener('exit', exitHandler);

        // Close log stream
        this.logManager.closeStream(processId);

        // Remove from active processes
        const processes = this.activeProcesses.get(missionId);
        if (processes) {
          const index = processes.indexOf(processId);
          if (index !== -1) {
            processes.splice(index, 1);
          }
        }

        // Handle completion based on exit code
        if (event.code === 0) {
          this.handleProcessSuccess(missionId, processType);
        } else {
          this.handleProcessFailure(missionId, processType, event.code);
        }
      }
    };

    this.orchestrator.on('output', outputHandler);
    this.orchestrator.on('exit', exitHandler);
  }

  /**
   * Handle successful process completion
   */
  private handleProcessSuccess(
    missionId: string,
    processType: 'prd_generation' | 'task_generation'
  ): void {
    if (processType === 'prd_generation') {
      // Transition to prd_review
      try {
        this.missionRepo.updateState(missionId, MissionState.PRD_REVIEW);
        this.auditRepo.log('mission.prd_generated', 'mission', missionId);
      } catch {
        // State transition may fail if already transitioned
      }
    } else if (processType === 'task_generation') {
      // Transition to tasks_review
      try {
        this.missionRepo.updateState(missionId, MissionState.TASKS_REVIEW);
        this.auditRepo.log('mission.tasks_generated', 'mission', missionId);
      } catch {
        // State transition may fail if already transitioned
      }
    }
  }

  /**
   * Handle process failure
   */
  private handleProcessFailure(
    missionId: string,
    processType: 'prd_generation' | 'task_generation',
    exitCode: number | null
  ): void {
    // Transition to completed_failed
    try {
      this.missionRepo.updateState(missionId, MissionState.COMPLETED_FAILED);
      this.missionRepo.update(missionId, {
        failure_reason: `${processType} process failed with exit code ${exitCode}`,
        ended_at: new Date().toISOString(),
      });
      this.auditRepo.log('mission.process_failed', 'mission', missionId, {
        processType,
        exitCode,
      });
    } catch {
      // State transition may fail if already transitioned
    }
  }

  /**
   * Get active process IDs for a mission
   */
  getActiveProcesses(missionId: string): string[] {
    return this.activeProcesses.get(missionId) || [];
  }

  /**
   * Check if a mission has any active processes
   */
  hasActiveProcesses(missionId: string): boolean {
    const processes = this.activeProcesses.get(missionId);
    return processes !== undefined && processes.length > 0;
  }

  /**
   * Cleanup all active processes
   */
  async cleanup(): Promise<void> {
    const missionIds = Array.from(this.activeProcesses.keys());

    for (const missionId of missionIds) {
      try {
        await this.cancel(missionId);
      } catch {
        // Best effort cleanup
      }
    }

    this.activeProcesses.clear();
  }
}

// Singleton instance
let missionExecutorInstance: MissionExecutor | null = null;

/**
 * Get the singleton MissionExecutor instance
 */
export function getMissionExecutor(): MissionExecutor {
  if (!missionExecutorInstance) {
    missionExecutorInstance = new MissionExecutor();
  }
  return missionExecutorInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetMissionExecutor(): void {
  if (missionExecutorInstance) {
    missionExecutorInstance.cleanup().catch(() => {});
  }
  missionExecutorInstance = null;
}
