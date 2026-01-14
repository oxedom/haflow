import { spawn, type ChildProcess } from 'child_process'

export interface OrchestratorOptions {
  cwd: string
  prompt: string
  onStdout?: (data: string) => void
  onStderr?: (data: string) => void
  onExit?: (code: number | null) => void
}

export interface RunningProcess {
  pid: number
  process: ChildProcess
  startedAt: Date
}

export class Orchestrator {
  private runningProcesses: Map<number, RunningProcess> = new Map()

  spawn(options: OrchestratorOptions): ChildProcess {
    const { cwd, prompt, onStdout, onStderr, onExit } = options

    const claudeProcess = spawn('claude', ['--print', prompt], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    })

    if (claudeProcess.pid) {
      this.runningProcesses.set(claudeProcess.pid, {
        pid: claudeProcess.pid,
        process: claudeProcess,
        startedAt: new Date()
      })
    }

    if (claudeProcess.stdout && onStdout) {
      claudeProcess.stdout.on('data', (data: Buffer) => {
        onStdout(data.toString())
      })
    }

    if (claudeProcess.stderr && onStderr) {
      claudeProcess.stderr.on('data', (data: Buffer) => {
        onStderr(data.toString())
      })
    }

    claudeProcess.on('exit', (code) => {
      if (claudeProcess.pid) {
        this.runningProcesses.delete(claudeProcess.pid)
      }
      if (onExit) {
        onExit(code)
      }
    })

    claudeProcess.on('error', (error) => {
      console.error('Process error:', error)
      if (claudeProcess.pid) {
        this.runningProcesses.delete(claudeProcess.pid)
      }
      if (onExit) {
        onExit(-1)
      }
    })

    return claudeProcess
  }

  kill(pid: number): boolean {
    const running = this.runningProcesses.get(pid)
    if (!running) {
      return false
    }

    try {
      running.process.kill('SIGTERM')
      this.runningProcesses.delete(pid)
      return true
    } catch (error) {
      console.error('Error killing process:', error)
      return false
    }
  }

  isRunning(pid: number): boolean {
    const running = this.runningProcesses.get(pid)
    if (!running) {
      return false
    }

    try {
      // Check if process is still alive
      process.kill(pid, 0)
      return true
    } catch {
      // Process is not running
      this.runningProcesses.delete(pid)
      return false
    }
  }

  getRunningProcesses(): RunningProcess[] {
    return Array.from(this.runningProcesses.values())
  }

  killAll(): void {
    for (const [pid] of this.runningProcesses) {
      this.kill(pid)
    }
  }
}

// Singleton instance
let orchestratorInstance: Orchestrator | null = null

export function getOrchestrator(): Orchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new Orchestrator()
  }
  return orchestratorInstance
}

export function resetOrchestrator(): void {
  if (orchestratorInstance) {
    orchestratorInstance.killAll()
    orchestratorInstance = null
  }
}
