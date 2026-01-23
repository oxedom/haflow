import { describe, it, expect, vi } from 'vitest';
import type { Response } from 'express';
import { sendSuccess, sendError } from '../../../src/utils/response.js';

function createMockResponse(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('response utils', () => {
  describe('sendSuccess', () => {
    it('sets default status code 200', () => {
      const res = createMockResponse();
      sendSuccess(res, { foo: 'bar' });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('respects custom status code', () => {
      const res = createMockResponse();
      sendSuccess(res, { foo: 'bar' }, 201);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('returns ApiResponse shape with success true', () => {
      const res = createMockResponse();
      const data = { foo: 'bar' };
      sendSuccess(res, data);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data,
        error: null,
      });
    });
  });

  describe('sendError', () => {
    it('sets default status code 400', () => {
      const res = createMockResponse();
      sendError(res, 'Something went wrong');
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('respects custom status code', () => {
      const res = createMockResponse();
      sendError(res, 'Not found', 404);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns ApiResponse shape with success false', () => {
      const res = createMockResponse();
      sendError(res, 'Something went wrong');
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        data: null,
        error: 'Something went wrong',
      });
    });
  });
});
