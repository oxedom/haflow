import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { MissionListItem } from '@haloop/shared';

const execAsync = promisify(exec);
const BASE_URL = 'http://localhost:4001';

// Track missions created during tests for cleanup
const createdMissionIds: string[] = [];

// Helper to create a mission via API
async function createTestMission(title = 'Test', type = 'feature', rawInput = 'Input') {
  const res = await request(BASE_URL)
    .post('/api/missions')
    .send({ title, type, rawInput });

  if (res.body.data?.mission_id) {
    createdMissionIds.push(res.body.data.mission_id);
  }
  return res;
}

describe('missions routes', () => {
  afterAll(async () => {
    // Clean up created missions by removing their directories
    // This is a best-effort cleanup - the server uses ~/.haloop/missions
    try {
      for (const id of createdMissionIds) {
        await execAsync(`rm -rf ~/.haloop/missions/${id}`).catch(() => {});
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('GET /api/missions', () => {
    it('returns 200 with success true', async () => {
      const res = await request(BASE_URL).get('/api/missions');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('includes created mission in list', async () => {
      const createRes = await createTestMission('List Test', 'feature', 'Input');
      const missionId = createRes.body.data.mission_id;

      const res = await request(BASE_URL).get('/api/missions');

      expect(res.status).toBe(200);
      const found = res.body.data.find((m: MissionListItem) => m.mission_id === missionId);
      expect(found).toBeDefined();
      expect(found.title).toBe('List Test');
    });

    it('missions sorted by updated_at desc (most recent first)', async () => {
      const m1 = await createTestMission('First', 'feature', 'Input');
      await new Promise(r => setTimeout(r, 50)); // Ensure different timestamps
      const m2 = await createTestMission('Second', 'feature', 'Input');

      const res = await request(BASE_URL).get('/api/missions');

      // Find positions of our test missions
      const m1Index = res.body.data.findIndex((m: MissionListItem) => m.mission_id === m1.body.data.mission_id);
      const m2Index = res.body.data.findIndex((m: MissionListItem) => m.mission_id === m2.body.data.mission_id);

      // m2 (more recent) should come before m1
      expect(m2Index).toBeLessThan(m1Index);
    });
  });

  describe('GET /api/missions/:missionId', () => {
    it('returns 404 for non-existent mission', async () => {
      const res = await request(BASE_URL).get('/api/missions/m-nonexist');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('not found');
    });

    it('returns MissionDetail for valid ID', async () => {
      const createRes = await createTestMission('Detail Test', 'feature', 'Input');
      const missionId = createRes.body.data.mission_id;

      const res = await request(BASE_URL).get(`/api/missions/${missionId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mission_id).toBe(missionId);
      expect(res.body.data.title).toBe('Detail Test');
    });

    it('includes workflow in response', async () => {
      const createRes = await createTestMission('Workflow Test', 'feature', 'Input');
      const missionId = createRes.body.data.mission_id;

      const res = await request(BASE_URL).get(`/api/missions/${missionId}`);

      expect(res.body.data.workflow).toBeDefined();
      expect(res.body.data.workflow.workflow_id).toBe('standard-feature');
      expect(res.body.data.workflow.steps).toHaveLength(8);
    });

    it('includes artifacts in response', async () => {
      const createRes = await createTestMission('Artifact Test', 'feature', 'My input');
      const missionId = createRes.body.data.mission_id;

      const res = await request(BASE_URL).get(`/api/missions/${missionId}`);

      expect(res.body.data.artifacts).toBeDefined();
      expect(res.body.data.artifacts['raw-input.md']).toBe('My input');
    });
  });

  describe('POST /api/missions', () => {
    it('returns 400 for missing title', async () => {
      const res = await request(BASE_URL)
        .post('/api/missions')
        .send({ type: 'feature', rawInput: 'Input' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('title');
    });

    it('returns 400 for missing type', async () => {
      const res = await request(BASE_URL)
        .post('/api/missions')
        .send({ title: 'Test', rawInput: 'Input' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('type');
    });

    it('returns 400 for missing rawInput', async () => {
      const res = await request(BASE_URL)
        .post('/api/missions')
        .send({ title: 'Test', type: 'feature' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('rawInput');
    });

    it('returns 201 with MissionMeta on success', async () => {
      const res = await createTestMission('New Mission', 'feature', 'My input');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mission_id).toMatch(/^m-[a-f0-9]{8}$/);
      expect(res.body.data.title).toBe('New Mission');
      expect(res.body.data.status).toBe('ready');
    });

    it('creates mission that can be retrieved', async () => {
      const createRes = await createTestMission('Persist Test', 'feature', 'Input');
      const missionId = createRes.body.data.mission_id;

      const getRes = await request(BASE_URL).get(`/api/missions/${missionId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.title).toBe('Persist Test');
    });
  });

  describe('PUT /api/missions/:missionId/artifacts/:filename', () => {
    it('returns 404 for non-existent mission', async () => {
      const res = await request(BASE_URL)
        .put('/api/missions/m-nonexist/artifacts/test.md')
        .send({ content: 'Test content' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('saves artifact content', async () => {
      const createRes = await createTestMission('Artifact Save', 'feature', 'Input');
      const missionId = createRes.body.data.mission_id;

      const putRes = await request(BASE_URL)
        .put(`/api/missions/${missionId}/artifacts/output.md`)
        .send({ content: 'New artifact content' });

      expect(putRes.status).toBe(200);
      expect(putRes.body.success).toBe(true);

      // Verify by getting mission detail
      const getRes = await request(BASE_URL).get(`/api/missions/${missionId}`);
      expect(getRes.body.data.artifacts['output.md']).toBe('New artifact content');
    });

    it('updates mission updated_at', async () => {
      const createRes = await createTestMission('Timestamp Test', 'feature', 'Input');
      const missionId = createRes.body.data.mission_id;
      const originalUpdatedAt = createRes.body.data.updated_at;

      await new Promise(r => setTimeout(r, 50));

      await request(BASE_URL)
        .put(`/api/missions/${missionId}/artifacts/output.md`)
        .send({ content: 'Content' });

      const getRes = await request(BASE_URL).get(`/api/missions/${missionId}`);
      expect(getRes.body.data.updated_at > originalUpdatedAt).toBe(true);
    });
  });

  describe('POST /api/missions/:missionId/continue', () => {
    it('returns 404 for non-existent mission', async () => {
      const res = await request(BASE_URL)
        .post('/api/missions/m-nonexist/continue');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 200 on success', async () => {
      const createRes = await createTestMission('Continue Test', 'feature', 'Input');
      const missionId = createRes.body.data.mission_id;

      const res = await request(BASE_URL)
        .post(`/api/missions/${missionId}/continue`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/missions/:missionId/mark-completed', () => {
    it('returns 404 for non-existent mission', async () => {
      const res = await request(BASE_URL)
        .post('/api/missions/m-nonexist/mark-completed');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('sets status to completed', async () => {
      const createRes = await createTestMission('Complete Test', 'feature', 'Input');
      const missionId = createRes.body.data.mission_id;

      const res = await request(BASE_URL)
        .post(`/api/missions/${missionId}/mark-completed`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const getRes = await request(BASE_URL).get(`/api/missions/${missionId}`);
      expect(getRes.body.data.status).toBe('completed');
    });
  });
});
