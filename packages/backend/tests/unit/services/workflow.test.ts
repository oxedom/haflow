import { describe, it, expect } from 'vitest';
import {
  getDefaultWorkflowId,
  getDefaultWorkflow,
  getWorkflowStepName,
  getStepPrompt,
} from '../../../src/services/workflow.js';

describe('workflow service', () => {
  describe('getDefaultWorkflowId', () => {
    it('returns raw-research-plan-implement', () => {
      expect(getDefaultWorkflowId()).toBe('raw-research-plan-implement');
    });
  });

  describe('getDefaultWorkflow', () => {
    it('returns valid Workflow with workflow_id', () => {
      const workflow = getDefaultWorkflow();
      expect(workflow.workflow_id).toBe('raw-research-plan-implement');
    });

    it('returns valid Workflow with name', () => {
      const workflow = getDefaultWorkflow();
      expect(workflow.name).toBe('Raw Research Plan Implement');
    });

    it('has 8 steps', () => {
      const workflow = getDefaultWorkflow();
      expect(workflow.steps).toHaveLength(8);
    });

    it('alternates between agent and human-gate steps', () => {
      const workflow = getDefaultWorkflow();

      // Even indices (0,2,4,6) should be agent
      expect(workflow.steps[0].type).toBe('agent');
      expect(workflow.steps[2].type).toBe('agent');
      expect(workflow.steps[4].type).toBe('agent');
      expect(workflow.steps[6].type).toBe('agent');

      // Odd indices (1,3,5,7) should be human-gate
      expect(workflow.steps[1].type).toBe('human-gate');
      expect(workflow.steps[3].type).toBe('human-gate');
      expect(workflow.steps[5].type).toBe('human-gate');
      expect(workflow.steps[7].type).toBe('human-gate');
    });

    it('agent steps have inputArtifact and outputArtifact', () => {
      const workflow = getDefaultWorkflow();
      const agentSteps = workflow.steps.filter(s => s.type === 'agent');

      for (const step of agentSteps) {
        expect(step.inputArtifact).toBeDefined();
        expect(step.outputArtifact).toBeDefined();
      }
    });

    it('human-gate steps have reviewArtifact', () => {
      const workflow = getDefaultWorkflow();
      const humanGateSteps = workflow.steps.filter(s => s.type === 'human-gate');

      for (const step of humanGateSteps) {
        expect(step.reviewArtifact).toBeDefined();
      }
    });
  });

  describe('getWorkflowStepName', () => {
    it('returns correct name for valid stepIndex', () => {
      expect(getWorkflowStepName('raw-research-plan-implement', 0)).toBe('Cleanup');
      expect(getWorkflowStepName('raw-research-plan-implement', 1)).toBe('Review Structured');
      expect(getWorkflowStepName('raw-research-plan-implement', 7)).toBe('Review Implementation');
    });

    it('returns Complete for out-of-bounds stepIndex', () => {
      expect(getWorkflowStepName('raw-research-plan-implement', 8)).toBe('Complete');
      expect(getWorkflowStepName('raw-research-plan-implement', 100)).toBe('Complete');
    });

    it('falls back to default workflow for unknown workflowId', () => {
      expect(getWorkflowStepName('unknown-workflow', 0)).toBe('Cleanup');
    });
  });

  describe('getStepPrompt', () => {
    it('returns prompt for cleanup step', () => {
      const workflow = getDefaultWorkflow();
      const cleanupStep = workflow.steps[0];
      const prompt = getStepPrompt(cleanupStep);

      expect(prompt).toContain('raw-input.md');
      expect(prompt).toContain('structured-text.md');
      expect(prompt).toContain('<promise>COMPLETE</promise>');
    });

    it('returns prompt for research step', () => {
      const workflow = getDefaultWorkflow();
      const researchStep = workflow.steps[2];
      const prompt = getStepPrompt(researchStep);

      expect(prompt).toContain('structured-text.md');
      expect(prompt).toContain('research-output.md');
      expect(prompt).toContain('<promise>COMPLETE</promise>');
    });

    it('returns prompt for planning step', () => {
      const workflow = getDefaultWorkflow();
      const planningStep = workflow.steps[4];
      const prompt = getStepPrompt(planningStep);

      expect(prompt).toContain('research-output.md');
      expect(prompt).toContain('implementation-plan.md');
      expect(prompt).toContain('<promise>COMPLETE</promise>');
    });

    it('returns prompt for implementation step', () => {
      const workflow = getDefaultWorkflow();
      const implStep = workflow.steps[6];
      const prompt = getStepPrompt(implStep);

      expect(prompt).toContain('implementation-plan.md');
      expect(prompt).toContain('implementation-result.json');
      expect(prompt).toContain('<promise>COMPLETE</promise>');
    });

    it('returns fallback prompt for unknown step', () => {
      const unknownStep = {
        step_id: 'unknown-step',
        name: 'Unknown',
        type: 'agent' as const,
        inputArtifact: 'input.md',
        outputArtifact: 'output.md',
      };
      const prompt = getStepPrompt(unknownStep);

      expect(prompt).toContain('input.md');
      expect(prompt).toContain('output.md');
      expect(prompt).toContain('<promise>COMPLETE</promise>');
    });

    it('all agent steps have prompts with COMPLETE marker', () => {
      const workflow = getDefaultWorkflow();
      const agentSteps = workflow.steps.filter(s => s.type === 'agent');

      for (const step of agentSteps) {
        const prompt = getStepPrompt(step);
        expect(prompt).toContain('<promise>COMPLETE</promise>');
      }
    });
  });
});
