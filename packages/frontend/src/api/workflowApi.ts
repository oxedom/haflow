import type { Workflow } from '@haflow/shared';
import { api } from './client';

// Re-export workflow-related functions from main client
export const getWorkflowTemplates = api.getWorkflowTemplates;
export const executeWorkflow = api.executeWorkflow;
export const executeWorkflowTemplate = api.executeWorkflowTemplate;

// Additional workflow-specific utilities
export async function saveWorkflow(workflow: Workflow): Promise<void> {
  // For now, workflows are not persisted - they're executed directly
  // This is a placeholder for future persistence functionality
  console.log('Workflow save not yet implemented', workflow);
}

export async function validateAndExecuteWorkflow(workflow: Workflow): Promise<{
  workflow_id: string;
  name: string;
  steps_count: number;
  message: string;
}> {
  // Execute workflow (backend will validate)
  return executeWorkflow(workflow);
}

export { api };
