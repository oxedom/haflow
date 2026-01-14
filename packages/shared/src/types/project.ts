export interface Project {
  id: string
  name: string
  path: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ProjectCreateInput {
  name: string
  path: string
}

export interface ProjectUpdateInput {
  name?: string
  isActive?: boolean
}
