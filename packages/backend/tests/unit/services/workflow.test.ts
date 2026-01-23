import { describe, it, expect } from 'vitest';
import {
  getDefaultWorkflowId,
  getDefaultWorkflow,
  getWorkflowStepName,
} from '../../../src/services/workflow.js';

describe('workflow service', () => {
  describe('getDefaultWorkflowId', () => {
    it('returns standard-feature', () => {
      expect(getDefaultWorkflowId()).toBe('standard-feature');
    });
  });

  describe('getDefaultWorkflow', () => {
    it('returns valid Workflow with workflow_id', () => {
      const workflow = getDefaultWorkflow();
      expect(workflow.workflow_id).toBe('standard-feature');
    });

    it('returns valid Workflow with name', () => {
      const workflow = getDefaultWorkflow();
      expect(workflow.name).toBe('Standard Feature');
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
      expect(getWorkflowStepName('standard-feature', 0)).toBe('Cleanup');
      expect(getWorkflowStepName('standard-feature', 1)).toBe('Review Structured');
      expect(getWorkflowStepName('standard-feature', 7)).toBe('Review Implementation');
    });

    it('returns Complete for out-of-bounds stepIndex', () => {
      expect(getWorkflowStepName('standard-feature', 8)).toBe('Complete');
      expect(getWorkflowStepName('standard-feature', 100)).toBe('Complete');
    });

    it('falls back to default workflow for unknown workflowId', () => {
      expect(getWorkflowStepName('unknown-workflow', 0)).toBe('Cleanup');
    });
  });
});
