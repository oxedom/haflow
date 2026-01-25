import { describe, it, expect } from 'vitest';
import request from 'supertest';
import type { Workflow } from '@haflow/shared';

const BASE_URL = 'http://localhost:4001';

describe('workflow routes', () => {
  describe('GET /api/workflows', () => {
    it('returns 200 with workflow list', async () => {
      const res = await request(BASE_URL).get('/api/workflows');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('includes raw-research-plan-implement workflow', async () => {
      const res = await request(BASE_URL).get('/api/workflows');

      const workflow = res.body.data.find((w: Workflow) => w.workflow_id === 'raw-research-plan-implement');
      expect(workflow).toBeDefined();
      expect(workflow.name).toBe('Raw Research Plan Implement');
      expect(workflow.steps.length).toBeGreaterThan(0);
    });

    it('includes oneshot workflow', async () => {
      const res = await request(BASE_URL).get('/api/workflows');

      const workflow = res.body.data.find((w: Workflow) => w.workflow_id === 'oneshot');
      expect(workflow).toBeDefined();
      expect(workflow.name).toBe('Oneshot');
    });
  });

  describe('GET /api/workflows/templates', () => {
    it('returns 200 with templates list', async () => {
      const res = await request(BASE_URL).get('/api/workflows/templates');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns same data as /api/workflows', async () => {
      const workflowsRes = await request(BASE_URL).get('/api/workflows');
      const templatesRes = await request(BASE_URL).get('/api/workflows/templates');

      expect(templatesRes.body.data.length).toBe(workflowsRes.body.data.length);
    });
  });

  describe('POST /api/workflows/execute', () => {
    it('returns 400 when neither workflowId nor workflow provided', async () => {
      const res = await request(BASE_URL)
        .post('/api/workflows/execute')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('workflowId or workflow required');
    });

    it('returns 404 for non-existent template workflow', async () => {
      const res = await request(BASE_URL)
        .post('/api/workflows/execute')
        .send({ workflowId: 'non-existent-workflow' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('not found');
    });

    it('validates and returns success for template workflow', async () => {
      const res = await request(BASE_URL)
        .post('/api/workflows/execute')
        .send({ workflowId: 'raw-research-plan-implement' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.workflow_id).toBe('raw-research-plan-implement');
      expect(res.body.data.steps_count).toBe(8);
    });

    it('validates valid dynamic workflow', async () => {
      const workflow = {
        workflow_id: 'test-workflow',
        name: 'Test Workflow',
        steps: [
          {
            step_id: 'step1',
            name: 'Cleanup',
            type: 'agent',
            agent: 'cleanup-agent',
            inputArtifact: 'raw-input.md',
            outputArtifact: 'structured.md',
            workspaceMode: 'document',
          },
        ],
      };

      const res = await request(BASE_URL)
        .post('/api/workflows/execute')
        .send({ workflow });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.workflow_id).toBe('test-workflow');
      expect(res.body.data.steps_count).toBe(1);
    });

    it('rejects workflow with empty steps', async () => {
      const workflow = {
        workflow_id: 'test-workflow',
        name: 'Test Workflow',
        steps: [],
      };

      const res = await request(BASE_URL)
        .post('/api/workflows/execute')
        .send({ workflow });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('at least one step');
    });

    it('rejects agent node without agent type', async () => {
      const workflow = {
        workflow_id: 'test-workflow',
        name: 'Test Workflow',
        steps: [
          {
            step_id: 'step1',
            name: 'Agent Step',
            type: 'agent',
            // Missing agent type
            workspaceMode: 'document',
          },
        ],
      };

      const res = await request(BASE_URL)
        .post('/api/workflows/execute')
        .send({ workflow });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('agent type');
    });

    it('accepts human-gate without agent type', async () => {
      const workflow = {
        workflow_id: 'test-workflow',
        name: 'Test Workflow',
        steps: [
          {
            step_id: 'step1',
            name: 'Human Gate',
            type: 'human-gate',
            reviewArtifact: 'output.md',
            workspaceMode: 'document',
          },
        ],
      };

      const res = await request(BASE_URL)
        .post('/api/workflows/execute')
        .send({ workflow });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('accepts code-review without agent type', async () => {
      const workflow = {
        workflow_id: 'test-workflow',
        name: 'Test Workflow',
        steps: [
          {
            step_id: 'step1',
            name: 'Code Review',
            type: 'code-review',
            workspaceMode: 'codegen',
            quickCommands: ['npm test'],
          },
        ],
      };

      const res = await request(BASE_URL)
        .post('/api/workflows/execute')
        .send({ workflow });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('validates multi-step workflow', async () => {
      const workflow = {
        workflow_id: 'multi-step',
        name: 'Multi Step',
        steps: [
          {
            step_id: 'cleanup',
            name: 'Cleanup',
            type: 'agent',
            agent: 'cleanup-agent',
            inputArtifact: 'raw-input.md',
            outputArtifact: 'structured.md',
            workspaceMode: 'document',
          },
          {
            step_id: 'review',
            name: 'Review',
            type: 'human-gate',
            reviewArtifact: 'structured.md',
            workspaceMode: 'document',
          },
          {
            step_id: 'impl',
            name: 'Implementation',
            type: 'agent',
            agent: 'impl-agent',
            inputArtifact: 'structured.md',
            outputArtifact: 'result.json',
            workspaceMode: 'codegen',
          },
        ],
      };

      const res = await request(BASE_URL)
        .post('/api/workflows/execute')
        .send({ workflow });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.steps_count).toBe(3);
    });
  });
});
