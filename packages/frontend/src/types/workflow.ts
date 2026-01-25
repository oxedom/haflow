// Re-export shared types for convenience
export type {
  Workflow,
  WorkflowStep,
  WorkspaceMode,
  StepType,
} from '@haflow/shared';

// Agent types for workflow builder
export type AgentType = 'cleanup-agent' | 'research-agent' | 'planning-agent' | 'impl-agent';

// Node type for the workflow builder (subset of StepType)
export type NodeType = 'agent' | 'human-gate' | 'code-review';

// Extended WorkflowStep with execution status for viewer
export interface WorkflowStepWithStatus {
  step_id: string;
  name: string;
  type: NodeType;
  agent?: AgentType;
  inputArtifact?: string;
  outputArtifact?: string;
  reviewArtifact?: string;
  workspaceMode: 'document' | 'codegen';
  quickCommands?: string[];
  executionStatus?: ExecutionStatus;
}

// Execution status for workflow viewer
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed';

// React Flow specific types
export interface WorkflowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: WorkflowStepWithStatus;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

// State management types
export interface WorkflowBuilderState {
  workflowId: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNodeId: string | null;
  isDirty: boolean;
}

// Validation error type
export interface ValidationError {
  nodeId?: string;
  field?: string;
  message: string;
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
