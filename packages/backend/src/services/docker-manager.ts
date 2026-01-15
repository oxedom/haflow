import Docker from 'dockerode';
import { Readable, Duplex } from 'stream';
import { ProcessStatus } from '@ralphy/shared';
import { ProcessRepository } from '../database/repositories/processes';

/**
 * Options for creating a Docker container
 */
export interface CreateContainerOptions {
  /** Image to use for the container */
  image?: string;
  /** Working directory inside the container */
  workingDir?: string;
  /** Command to run */
  command?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Host paths to bind mount */
  binds?: string[];
  /** Mission ID for labeling */
  missionId?: string;
  /** Memory limit in bytes (default: 1GB) */
  memoryLimit?: number;
  /** CPU quota (default: 1 CPU) */
  cpuQuota?: number;
  /** Process limit (default: 100) */
  pidsLimit?: number;
}

/**
 * Container info returned from createContainer
 */
export interface ContainerInfo {
  containerId: string;
  processId: string;
}

/**
 * DockerManager service for managing Docker containers.
 * Provides methods to create, exec, attach logs, stop, and remove containers.
 */
export class DockerManager {
  private docker: Docker;
  private processRepo: ProcessRepository;

  constructor(processRepo?: ProcessRepository, docker?: Docker) {
    this.docker = docker || new Docker();
    this.processRepo = processRepo || new ProcessRepository();
  }

  /**
   * Create and start a Docker container with security settings
   */
  async createContainer(opts: CreateContainerOptions): Promise<ContainerInfo> {
    const image = opts.image || 'node:18-alpine';
    const workingDir = opts.workingDir || '/workspace';
    const memoryLimit = opts.memoryLimit || 1 * 1024 * 1024 * 1024; // 1GB
    const cpuQuota = opts.cpuQuota || 100000; // 1 CPU
    const pidsLimit = opts.pidsLimit || 100;

    // Build environment variables array
    const envArray = opts.env
      ? Object.entries(opts.env).map(([key, value]) => `${key}=${value}`)
      : [];

    // Get user ID for running container as current user
    const uid = process.getuid?.() ?? 1000;
    const gid = process.getgid?.() ?? 1000;

    // Create the container with security settings
    const container = await this.docker.createContainer({
      Image: image,
      WorkingDir: workingDir,
      Cmd: opts.command,
      Env: envArray,
      User: `${uid}:${gid}`,
      Labels: {
        'ralphy.managed': 'true',
        'ralphy.mission': opts.missionId || '',
      },
      HostConfig: {
        Memory: memoryLimit,
        CpuPeriod: 100000,
        CpuQuota: cpuQuota,
        PidsLimit: pidsLimit,
        Init: true,
        Binds: opts.binds,
        AutoRemove: false,
      },
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
    });

    const containerId = container.id;

    // Create database record for the process
    const processRecord = this.processRepo.create({
      type: 'container',
      command: opts.command?.join(' ') || '',
      cwd: workingDir,
      missionId: opts.missionId,
      env: opts.env,
    });

    // Update process record with container ID
    this.processRepo.updateContainerId(processRecord.id, containerId);

    // Start the container
    await container.start();

    // Update status to running
    this.processRepo.updateStatus(processRecord.id, ProcessStatus.RUNNING);

    return {
      containerId,
      processId: processRecord.id,
    };
  }

  /**
   * Execute a command in a running container
   * Returns a duplex stream for stdin/stdout/stderr
   */
  async exec(containerId: string, cmd: string[]): Promise<Duplex> {
    const container = this.docker.getContainer(containerId);

    const exec = await container.exec({
      Cmd: cmd,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
    });

    const stream = await exec.start({
      hijack: true,
      stdin: true,
    });

    return stream;
  }

  /**
   * Attach to container logs and return a stream
   * Follows the logs in real-time
   */
  async attachLogs(containerId: string): Promise<Readable> {
    const container = this.docker.getContainer(containerId);

    const logStream = await container.logs({
      follow: true,
      stdout: true,
      stderr: true,
      timestamps: true,
    });

    // Convert to a readable stream
    // Container logs returns a NodeJS.ReadableStream which is compatible with Readable
    return logStream as unknown as Readable;
  }

  /**
   * Stop a container gracefully (SIGTERM, then SIGKILL after timeout)
   */
  async stop(containerId: string, timeout: number = 10): Promise<void> {
    const container = this.docker.getContainer(containerId);

    try {
      await container.stop({ t: timeout });
    } catch (err) {
      // Container may already be stopped
      if (!(err instanceof Error) || !err.message.includes('304')) {
        throw err;
      }
    }
  }

  /**
   * Remove a container
   */
  async remove(containerId: string, force: boolean = false): Promise<void> {
    const container = this.docker.getContainer(containerId);

    try {
      await container.remove({ force, v: true });
    } catch (err) {
      // Container may already be removed
      if (!(err instanceof Error) || !err.message.includes('404')) {
        throw err;
      }
    }
  }

  /**
   * Inspect a container and return its state
   */
  async inspect(containerId: string): Promise<Docker.ContainerInspectInfo> {
    const container = this.docker.getContainer(containerId);
    return container.inspect();
  }

  /**
   * Check if a container is running
   */
  async isRunning(containerId: string): Promise<boolean> {
    try {
      const info = await this.inspect(containerId);
      return info.State?.Running ?? false;
    } catch {
      return false;
    }
  }

  /**
   * Get a container by ID
   */
  getContainer(containerId: string): Docker.Container {
    return this.docker.getContainer(containerId);
  }

  /**
   * Ping Docker daemon to check connectivity
   */
  async ping(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all Ralphy-managed containers
   */
  async listManagedContainers(): Promise<Docker.ContainerInfo[]> {
    return this.docker.listContainers({
      all: true,
      filters: {
        label: ['ralphy.managed=true'],
      },
    });
  }

  /**
   * List containers for a specific mission
   */
  async listContainersForMission(missionId: string): Promise<Docker.ContainerInfo[]> {
    return this.docker.listContainers({
      all: true,
      filters: {
        label: [`ralphy.mission=${missionId}`],
      },
    });
  }

  /**
   * Kill a container with a specific signal
   */
  async kill(containerId: string, signal: string = 'SIGTERM'): Promise<void> {
    const container = this.docker.getContainer(containerId);
    try {
      await container.kill({ signal });
    } catch (err) {
      // Container may not be running
      if (!(err instanceof Error) || !err.message.includes('404')) {
        throw err;
      }
    }
  }

  /**
   * Wait for a container to exit and return the exit code
   */
  async wait(containerId: string): Promise<{ StatusCode: number }> {
    const container = this.docker.getContainer(containerId);
    return container.wait();
  }

  /**
   * Pull an image if it doesn't exist locally
   */
  async pullImageIfNeeded(imageName: string): Promise<void> {
    try {
      await this.docker.getImage(imageName).inspect();
    } catch {
      // Image doesn't exist, pull it
      await new Promise<void>((resolve, reject) => {
        this.docker.pull(imageName, {}, (err, stream) => {
          if (err) {
            reject(err);
            return;
          }
          // Follow the pull progress
          this.docker.modem.followProgress(stream!, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });
    }
  }

  /**
   * Cleanup - stop and remove all Ralphy-managed containers
   */
  async cleanup(): Promise<void> {
    const containers = await this.listManagedContainers();

    for (const containerInfo of containers) {
      try {
        await this.stop(containerInfo.Id, 5);
        await this.remove(containerInfo.Id, true);
      } catch {
        // Best effort cleanup
      }
    }
  }
}

// Singleton instance
let dockerManagerInstance: DockerManager | null = null;

/**
 * Get the singleton DockerManager instance
 */
export function getDockerManager(): DockerManager {
  if (!dockerManagerInstance) {
    dockerManagerInstance = new DockerManager();
  }
  return dockerManagerInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetDockerManager(): void {
  if (dockerManagerInstance) {
    dockerManagerInstance.cleanup().catch(() => {});
  }
  dockerManagerInstance = null;
}
