import { TaskStatus } from './enums.js'

export interface Task {
  id: string
  missionId: string
  category: string
  description: string
  order: number
  status: TaskStatus
  agents: string[]
  skills: string[]
  stepsToVerify: string[]
  passes: number
  output: string | null
}

export interface TaskCreateInput {
  missionId: string
  category: string
  description: string
  order: number
  agents?: string[]
  skills?: string[]
  stepsToVerify?: string[]
}

export interface TaskUpdateInput {
  status?: TaskStatus
  output?: string
  passes?: number
}
