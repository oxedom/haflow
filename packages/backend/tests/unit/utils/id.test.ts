import { describe, it, expect } from 'vitest';
import { generateMissionId, generateRunId } from '../../../src/utils/id.js';

describe('id utils', () => {
  describe('generateMissionId', () => {
    it('returns prefixed ID starting with m-', () => {
      const id = generateMissionId();
      expect(id).toMatch(/^m-/);
    });

    it('returns 10-char ID (m- + 8 hex chars)', () => {
      const id = generateMissionId();
      expect(id).toHaveLength(10);
      expect(id).toMatch(/^m-[a-f0-9]{8}$/);
    });

    it('returns unique IDs on multiple calls', () => {
      const ids = new Set([
        generateMissionId(),
        generateMissionId(),
        generateMissionId(),
        generateMissionId(),
        generateMissionId(),
      ]);
      expect(ids.size).toBe(5);
    });
  });

  describe('generateRunId', () => {
    it('returns prefixed ID starting with r-', () => {
      const id = generateRunId();
      expect(id).toMatch(/^r-/);
    });

    it('returns 10-char ID (r- + 8 hex chars)', () => {
      const id = generateRunId();
      expect(id).toHaveLength(10);
      expect(id).toMatch(/^r-[a-f0-9]{8}$/);
    });
  });
});
