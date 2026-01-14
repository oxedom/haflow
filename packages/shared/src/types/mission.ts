import { MissionStatus } from './enums.js'

export interface Mission {
  id: string
  projectId: string
  name: string
  status: MissionStatus
  branchName: string | null
  draftContent: string
  prdContent: string | null
  prdIterations: number
  tasksIterations: number
  createdAt: string
  updatedAt: string
  startedAt: string | null
  completedAt: string | null
  containerId: string | null
  worktreePath: string | null
}

export interface MissionCreateInput {
  projectId: string
  name: string
  draftContent: string
}

export interface MissionUpdateInput {
  name?: string
  draftContent?: string
  prdContent?: string
  status?: MissionStatus
}
