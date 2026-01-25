import type { Workflow, WorkflowStep } from '@haflow/shared';

// Hardcoded for v0
const WORKFLOWS: Record<string, Workflow> = {
  'raw-research-plan-implement': {
    workflow_id: 'raw-research-plan-implement',
    name: 'Raw Research Plan Implement',
    steps: [
      { step_id: 'cleanup', name: 'Cleanup', type: 'agent', agent: 'cleanup-agent', inputArtifact: 'raw-input.md', outputArtifact: 'structured-text.md', workspaceMode: 'document' },
      { step_id: 'review-structured', name: 'Review Structured', type: 'human-gate', reviewArtifact: 'structured-text.md', workspaceMode: 'document' },
      { step_id: 'research', name: 'Research', type: 'agent', agent: 'research-agent', inputArtifact: 'structured-text.md', outputArtifact: 'research-output.md', workspaceMode: 'document' },
      { step_id: 'review-research', name: 'Review Research', type: 'human-gate', reviewArtifact: 'research-output.md', workspaceMode: 'document' },
      { step_id: 'planning', name: 'Planning', type: 'agent', agent: 'planning-agent', inputArtifact: 'research-output.md', outputArtifact: 'implementation-plan.md', workspaceMode: 'document' },
      { step_id: 'review-plan', name: 'Review Plan', type: 'human-gate', reviewArtifact: 'implementation-plan.md', workspaceMode: 'document' },
      { step_id: 'implementation', name: 'Implementation', type: 'agent', agent: 'impl-agent', inputArtifact: 'implementation-plan.md', outputArtifact: 'implementation-result.json', workspaceMode: 'codegen' },
      { step_id: 'review-impl', name: 'Review Implementation', type: 'code-review', workspaceMode: 'codegen', quickCommands: ['npm test', 'npm run lint', 'npm run build'] },
    ],
  },
  'oneshot': {
    workflow_id: 'oneshot',
    name: 'Oneshot',
    steps: [
      { step_id: 'codegen', name: 'Code Generation', type: 'agent', agent: 'impl-agent', inputArtifact: 'raw-input.md', outputArtifact: 'implementation-result.json', workspaceMode: 'codegen' },
      { step_id: 'review', name: 'Review', type: 'code-review', workspaceMode: 'codegen', quickCommands: ['git status'] },
    ],
  },
};

// Step-specific prompts for Claude agents - references to .claude/ files
const STEP_PROMPTS: Record<string, string> = {
  'cleanup': `@.claude/skills/small-to-before-research/SKILL.md

Read: raw-input.md
Output: structured-text.md`,

  'research': `@.claude/commands/research_codebase_generic.md

Read: structured-text.md
Output: research-output.md`,

  'planning': `@.claude/commands/create_plan_generic.md

Read: research-output.md
Output: implementation-plan.md`,

  'implementation': `@.claude/commands/implement_plan.md

Read: implementation-plan.md
Output: implementation-result.json`,

  'codegen': `@.claude/commands/oneshot.md

Read: raw-input.md
Output: implementation-result.json`,
};

// Get the prompt for a specific step
export function getStepPrompt(step: WorkflowStep): string {
  const basePrompt = STEP_PROMPTS[step.step_id];
  if (basePrompt) return basePrompt;

  // Fallback generic prompt if step not found
  return `Read the file "${step.inputArtifact}" and process it according to the step "${step.name}".
Write your output to "${step.outputArtifact}".
When you are satisfied with the output, include <promise>COMPLETE</promise> at the end of your response.`;
}

export function getDefaultWorkflowId(): string {
  return 'raw-research-plan-implement';
}

export function getDefaultWorkflow(): Workflow {
  return WORKFLOWS[getDefaultWorkflowId()]!;
}

export function getWorkflows(): Workflow[] {
  return Object.values(WORKFLOWS);
}

export function getWorkflowById(workflowId: string): Workflow | undefined {
  return WORKFLOWS[workflowId];
}

export function getWorkflowStepName(workflowId: string, stepIndex: number): string {
  const workflow = WORKFLOWS[workflowId] || getDefaultWorkflow();
  return workflow.steps[stepIndex]?.name || 'Complete';
}
