import { v4 as uuid } from 'uuid'
import { MissionStatus, TaskStatus, LogLevel } from '@ralphy/shared'
import { getDatabase } from '../database/connection.js'
import { getOrchestrator } from './orchestrator.js'
import { mkdirSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'

interface MissionRow {
  id: string
  project_id: string
  name: string
  status: string
  draft_content: string
  prd_content: string | null
  worktree_path: string | null
}

interface ProjectRow {
  id: string
  path: string
}

interface TaskRow {
  id: string
  mission_id: string
  category: string
  description: string
  order_num: number
  status: string
  agents: string | null
  skills: string | null
  steps_to_verify: string | null
}

export class MissionExecutor {
  private activeMissions: Map<string, { pid: number; output: string }> = new Map()

  async generatePRD(missionId: string): Promise<void> {
    const db = getDatabase()
    const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(missionId) as MissionRow | undefined

    if (!mission) {
      throw new Error(`Mission not found: ${missionId}`)
    }

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(mission.project_id) as ProjectRow | undefined

    if (!project) {
      throw new Error(`Project not found: ${mission.project_id}`)
    }

    this.log(missionId, LogLevel.INFO, 'Starting PRD generation')

    const prompt = `Generate a Product Requirements Document (PRD) for the following feature request:

${mission.draft_content}

Please provide a comprehensive PRD that includes:
1. Overview
2. Goals and objectives
3. User stories
4. Technical requirements
5. Acceptance criteria
6. Implementation phases

Format the output as markdown.`

    const orchestrator = getOrchestrator()
    let output = ''

    return new Promise((resolve, reject) => {
      const claudeProcess = orchestrator.spawn({
        cwd: project.path,
        prompt,
        onStdout: (data) => {
          output += data
          this.log(missionId, LogLevel.DEBUG, `PRD output: ${data.slice(0, 100)}...`)
        },
        onStderr: (data) => {
          this.log(missionId, LogLevel.WARN, `PRD stderr: ${data}`)
        },
        onExit: (code) => {
          if (code === 0) {
            const now = new Date().toISOString()
            db.prepare(`
              UPDATE missions SET prd_content = ?, status = ?, updated_at = ? WHERE id = ?
            `).run(output, MissionStatus.PRD_REVIEW, now, missionId)

            this.savePRDToFile(missionId, mission.name, project.path, output)
            this.log(missionId, LogLevel.INFO, 'PRD generation completed')
            this.activeMissions.delete(missionId)
            resolve()
          } else {
            const now = new Date().toISOString()
            db.prepare(`
              UPDATE missions SET status = ?, updated_at = ? WHERE id = ?
            `).run(MissionStatus.DRAFT, now, missionId)

            this.log(missionId, LogLevel.ERROR, `PRD generation failed with code: ${code}`)
            this.activeMissions.delete(missionId)
            reject(new Error(`PRD generation failed with code: ${code}`))
          }
        }
      })

      if (claudeProcess.pid) {
        this.activeMissions.set(missionId, { pid: claudeProcess.pid, output: '' })
      }
    })
  }

  async generateTasks(missionId: string): Promise<void> {
    const db = getDatabase()
    const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(missionId) as MissionRow | undefined

    if (!mission) {
      throw new Error(`Mission not found: ${missionId}`)
    }

    if (!mission.prd_content) {
      throw new Error('PRD content is required to generate tasks')
    }

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(mission.project_id) as ProjectRow | undefined

    if (!project) {
      throw new Error(`Project not found: ${mission.project_id}`)
    }

    this.log(missionId, LogLevel.INFO, 'Starting task generation')

    const prompt = `Based on the following PRD, generate a list of implementation tasks in JSON format:

${mission.prd_content}

Return a JSON array of tasks with the following structure:
[
  {
    "category": "setup|implementation|testing|documentation",
    "description": "Task description",
    "agents": ["agent names if needed"],
    "skills": ["required skills"],
    "stepsToVerify": ["verification steps"]
  }
]

Only return the JSON array, no additional text.`

    const orchestrator = getOrchestrator()
    let output = ''

    return new Promise((resolve, reject) => {
      const claudeProcess = orchestrator.spawn({
        cwd: project.path,
        prompt,
        onStdout: (data) => {
          output += data
        },
        onStderr: (data) => {
          this.log(missionId, LogLevel.WARN, `Task generation stderr: ${data}`)
        },
        onExit: (code) => {
          if (code === 0) {
            try {
              const tasks = this.parseTasksFromOutput(output)
              this.createTasks(missionId, tasks)

              const now = new Date().toISOString()
              db.prepare(`
                UPDATE missions SET status = ?, updated_at = ? WHERE id = ?
              `).run(MissionStatus.TASKS_REVIEW, now, missionId)

              this.log(missionId, LogLevel.INFO, `Task generation completed, created ${tasks.length} tasks`)
              this.activeMissions.delete(missionId)
              resolve()
            } catch (parseError) {
              const now = new Date().toISOString()
              db.prepare(`
                UPDATE missions SET status = ?, updated_at = ? WHERE id = ?
              `).run(MissionStatus.PRD_REVIEW, now, missionId)

              this.log(missionId, LogLevel.ERROR, `Failed to parse tasks: ${parseError}`)
              this.activeMissions.delete(missionId)
              reject(parseError)
            }
          } else {
            const now = new Date().toISOString()
            db.prepare(`
              UPDATE missions SET status = ?, updated_at = ? WHERE id = ?
            `).run(MissionStatus.PRD_REVIEW, now, missionId)

            this.log(missionId, LogLevel.ERROR, `Task generation failed with code: ${code}`)
            this.activeMissions.delete(missionId)
            reject(new Error(`Task generation failed with code: ${code}`))
          }
        }
      })

      if (claudeProcess.pid) {
        this.activeMissions.set(missionId, { pid: claudeProcess.pid, output: '' })
      }
    })
  }

  async startMission(missionId: string): Promise<void> {
    const db = getDatabase()
    const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(missionId) as MissionRow | undefined

    if (!mission) {
      throw new Error(`Mission not found: ${missionId}`)
    }

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(mission.project_id) as ProjectRow | undefined

    if (!project) {
      throw new Error(`Project not found: ${mission.project_id}`)
    }

    const tasks = db.prepare('SELECT * FROM tasks WHERE mission_id = ? ORDER BY order_num ASC').all(missionId) as TaskRow[]

    if (tasks.length === 0) {
      throw new Error('No tasks to execute')
    }

    this.log(missionId, LogLevel.INFO, `Starting mission execution with ${tasks.length} tasks`)

    const now = new Date().toISOString()
    db.prepare(`
      UPDATE missions SET status = ?, started_at = ?, updated_at = ? WHERE id = ?
    `).run(MissionStatus.IN_PROGRESS, now, now, missionId)

    // Execute tasks sequentially
    for (const task of tasks) {
      try {
        await this.executeTask(missionId, task, project.path)
      } catch (error) {
        this.log(missionId, LogLevel.ERROR, `Task ${task.id} failed: ${error}`)
        // Continue with next task or stop based on your requirements
      }
    }

    // Check final status
    const completedTasks = db.prepare(`
      SELECT COUNT(*) as count FROM tasks WHERE mission_id = ? AND status = ?
    `).get(missionId, TaskStatus.COMPLETED) as { count: number }

    const totalTasks = tasks.length
    const finalStatus = completedTasks.count === totalTasks
      ? MissionStatus.COMPLETED_SUCCESS
      : MissionStatus.COMPLETED_FAILED

    const completedAt = new Date().toISOString()
    db.prepare(`
      UPDATE missions SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?
    `).run(finalStatus, completedAt, completedAt, missionId)

    this.log(missionId, LogLevel.INFO, `Mission completed with status: ${finalStatus}`)
    this.activeMissions.delete(missionId)
  }

  async stopMission(missionId: string): Promise<void> {
    const active = this.activeMissions.get(missionId)
    if (active) {
      const orchestrator = getOrchestrator()
      orchestrator.kill(active.pid)
      this.activeMissions.delete(missionId)
    }

    const db = getDatabase()
    const now = new Date().toISOString()
    db.prepare(`
      UPDATE missions SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?
    `).run(MissionStatus.COMPLETED_FAILED, now, now, missionId)

    this.log(missionId, LogLevel.INFO, 'Mission stopped by user')
  }

  private async executeTask(missionId: string, task: TaskRow, projectPath: string): Promise<void> {
    const db = getDatabase()

    db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(TaskStatus.IN_PROGRESS, task.id)
    this.log(missionId, LogLevel.INFO, `Executing task: ${task.description}`)

    const prompt = `Execute the following task:

Category: ${task.category}
Description: ${task.description}

${task.steps_to_verify ? `Steps to verify:\n${JSON.parse(task.steps_to_verify).join('\n')}` : ''}

Please complete this task and provide a summary of what was done.`

    const orchestrator = getOrchestrator()
    let output = ''

    return new Promise((resolve, reject) => {
      const claudeProcess = orchestrator.spawn({
        cwd: projectPath,
        prompt,
        onStdout: (data) => {
          output += data
        },
        onStderr: (data) => {
          this.log(missionId, LogLevel.WARN, `Task stderr: ${data}`)
        },
        onExit: (code) => {
          if (code === 0) {
            db.prepare(`
              UPDATE tasks SET status = ?, output = ?, passes = passes + 1 WHERE id = ?
            `).run(TaskStatus.COMPLETED, output, task.id)
            this.log(missionId, LogLevel.INFO, `Task completed: ${task.description}`)
            resolve()
          } else {
            db.prepare(`
              UPDATE tasks SET status = ?, output = ? WHERE id = ?
            `).run(TaskStatus.FAILED, output || `Exit code: ${code}`, task.id)
            this.log(missionId, LogLevel.ERROR, `Task failed: ${task.description}`)
            reject(new Error(`Task failed with code: ${code}`))
          }
        }
      })

      if (claudeProcess.pid) {
        this.activeMissions.set(missionId, { pid: claudeProcess.pid, output: '' })
      }
    })
  }

  private parseTasksFromOutput(output: string): Array<{
    category: string
    description: string
    agents?: string[]
    skills?: string[]
    stepsToVerify?: string[]
  }> {
    // Try to extract JSON from the output
    const jsonMatch = output.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('No JSON array found in output')
    }

    return JSON.parse(jsonMatch[0])
  }

  private createTasks(missionId: string, tasks: Array<{
    category: string
    description: string
    agents?: string[]
    skills?: string[]
    stepsToVerify?: string[]
  }>): void {
    const db = getDatabase()

    // Clear existing tasks
    db.prepare('DELETE FROM tasks WHERE mission_id = ?').run(missionId)

    const stmt = db.prepare(`
      INSERT INTO tasks (id, mission_id, category, description, order_num, status, agents, skills, steps_to_verify)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    tasks.forEach((task, index) => {
      stmt.run(
        uuid(),
        missionId,
        task.category,
        task.description,
        index + 1,
        TaskStatus.PENDING,
        task.agents ? JSON.stringify(task.agents) : null,
        task.skills ? JSON.stringify(task.skills) : null,
        task.stepsToVerify ? JSON.stringify(task.stepsToVerify) : null
      )
    })
  }

  private savePRDToFile(missionId: string, missionName: string, projectPath: string, content: string): void {
    const ralphyDir = join(projectPath, '.ralphy', 'missions', missionName.replace(/[^a-z0-9]/gi, '-').toLowerCase())

    if (!existsSync(ralphyDir)) {
      mkdirSync(ralphyDir, { recursive: true })
    }

    const prdPath = join(ralphyDir, 'prd.md')
    writeFileSync(prdPath, content)

    this.log(missionId, LogLevel.INFO, `PRD saved to ${prdPath}`)
  }

  private log(missionId: string, level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    const db = getDatabase()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO logs (id, mission_id, level, message, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuid(), missionId, level, message, now, metadata ? JSON.stringify(metadata) : null)
  }

  isActive(missionId: string): boolean {
    return this.activeMissions.has(missionId)
  }
}

// Singleton instance
let executorInstance: MissionExecutor | null = null

export function getMissionExecutor(): MissionExecutor {
  if (!executorInstance) {
    executorInstance = new MissionExecutor()
  }
  return executorInstance
}

export function resetMissionExecutor(): void {
  executorInstance = null
}
