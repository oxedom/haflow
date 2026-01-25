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
  'raw-plan-implement': {
    workflow_id: 'raw-plan-implement',
    name: 'Raw - Plan → Implement',
    steps: [
      { step_id: 'plan', name: 'Phase 1: Planning & Design', type: 'agent', agent: 'planning-agent', inputArtifact: 'raw-input.md', outputArtifact: 'planning-output.md', workspaceMode: 'document' },
      { step_id: 'review-plan', name: 'Review Planning', type: 'human-gate', reviewArtifact: 'planning-output.md', workspaceMode: 'document' },
      { step_id: 'implement', name: 'Phase 2: Implementation', type: 'agent', agent: 'impl-agent', inputArtifact: 'planning-output.md', outputArtifact: 'implementation-result.json', workspaceMode: 'codegen' },
      { step_id: 'review-impl', name: 'Review Implementation', type: 'code-review', workspaceMode: 'codegen', quickCommands: ['npm test', 'npm run lint', 'npm run build'] },
    ],
  },
};

// Step-specific prompts for Claude agents
const STEP_PROMPTS: Record<string, string> = {
  'cleanup': `You are a technical writer helping to structure raw feature requests.

Read the file "raw-input.md" and restructure it into a clear, well-organized document.

Your task:
1. Read raw-input.md carefully
2. Organize the content with clear sections and headings
3. Remove ambiguity and clarify vague requirements
4. Add structure: Problem Statement, Goals, Requirements, Constraints
5. Write the result to "structured-text.md"

Focus on: clarity, organization, completeness, removing ambiguity.

When you are satisfied with the output, include <promise>COMPLETE</promise> at the end of your response.`,

  'research': `You are a senior engineer researching implementation approaches.

Read the file "structured-text.md" and perform research to inform the implementation.

Your task:
1. Read structured-text.md to understand the requirements
2. Research the codebase for relevant patterns, APIs, and existing implementations
3. Identify dependencies, potential challenges, and architectural considerations
4. Document findings with references to specific files and code
5. Write the research findings to "research-output.md"

Focus on: thorough research, concrete references, actionable insights.

When you are satisfied with the output, include <promise>COMPLETE</promise> at the end of your response.`,

  'planning': `You are a software architect creating an implementation plan.

Read the file "research-output.md" and create a detailed implementation plan.

Your task:
1. Read research-output.md to understand the research findings
2. Design the implementation approach based on findings
3. Break down into specific, actionable tasks
4. Identify files to create/modify with specific changes
5. Include testing strategy and success criteria
6. Write the plan to "implementation-plan.md"

Focus on: specificity, actionability, testability, clear acceptance criteria.

When you are satisfied with the output, include <promise>COMPLETE</promise> at the end of your response.`,

  'implementation': `You are a senior software engineer implementing a feature.

You are working in the project root directory. The implementation plan is at ./artifacts/implementation-plan.md.

Your task:
1. Read artifacts/implementation-plan.md to understand what to build
2. Explore the codebase to understand the existing patterns and conventions
3. Implement each task in the plan by modifying files in the project
4. Write tests as specified
5. Ensure code quality and follows project conventions
6. Document what was done in "artifacts/implementation-result.json" with format:
   {
     "status": "completed" | "partial" | "blocked",
     "filesCreated": ["path/to/file1", ...],
     "filesModified": ["path/to/file2", ...],
     "testsAdded": ["test descriptions..."],
     "notes": "any important notes about the implementation"
   }

Focus on: correctness, code quality, following the plan, thorough testing.

When you are satisfied with the implementation, include <promise>COMPLETE</promise> at the end of your response.`,

  'codegen': `You are a senior software engineer implementing a feature request.

You are working in the project root directory. The user's request is at ./artifacts/raw-input.md.

Your task:
1. Read artifacts/raw-input.md to understand what to build
2. Explore the codebase to understand the existing patterns and conventions
3. Implement the requested feature by modifying files in the project
4. Write tests if appropriate
5. Ensure code quality and follows project conventions
6. Document what was done in "artifacts/implementation-result.json" with format:
   {
     "status": "completed" | "partial" | "blocked",
     "filesCreated": ["path/to/file1", ...],
     "filesModified": ["path/to/file2", ...],
     "testsAdded": ["test descriptions..."],
     "notes": "any important notes about the implementation"
   }

Focus on: correctness, code quality, following project patterns.

When you are satisfied with the implementation, include <promise>COMPLETE</promise> at the end of your response.`,

  'plan': `You are in the PLANNING & DESIGN phase of a two-phase workflow. Your role is to thoroughly understand the requirements, explore the codebase, and design a comprehensive implementation approach.

Read the file "raw-input.md" and create a detailed planning document.

Your task:
1. Read raw-input.md to understand the user's request
2. Explore the codebase to understand existing architecture, patterns, and conventions
3. Analyze the requirements and identify key challenges
4. Design a comprehensive implementation approach with clear architecture
5. Document all findings and create a detailed planning document
6. Write the planning document to "planning-output.md"

The planning document should include:
- Problem statement and requirements summary
- Codebase architecture overview and relevant patterns
- Proposed implementation approach with architecture decisions
- List of files to create/modify with specific changes
- Dependencies and integration points
- Known risks and mitigation strategies
- Testing strategy and success criteria

DO NOT implement or write code during this phase. Focus on thorough exploration and clear documentation.

When you have completed the planning document, include <promise>COMPLETE</promise> at the end of your response.`,

  'implement': `You are in the IMPLEMENTATION phase of a two-phase workflow. You have completed planning in Phase 1.

You have the following planning document from Phase 1: "planning-output.md"

Your task:
1. Read the planning document (planning-output.md) to understand the design and approach
2. Explore the codebase to understand existing patterns (referenced in the planning document)
3. Implement the planned changes by modifying files in the project according to the plan
4. Write tests as specified in the planning document
5. Ensure code quality and follows existing project conventions
6. Document what was done in "artifacts/implementation-result.json" with format:
   {
     "status": "completed" | "partial" | "blocked",
     "filesCreated": ["path/to/file1", ...],
     "filesModified": ["path/to/file2", ...],
     "testsAdded": ["test descriptions..."],
     "notes": "any important notes about the implementation"
   }

Implementation guidelines:
- Reference the planning document for architecture and approach
- Implement changes exactly according to the plan
- Follow existing code patterns and conventions documented in the plan
- Create tests as specified
- If you encounter issues requiring plan adjustment, explicitly note and propose solutions aligned with the original intent
- Focus on correctness, code quality, and plan adherence

When you are satisfied with the implementation and all success criteria from the plan are met, include <promise>COMPLETE</promise> at the end of your response.`,
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
