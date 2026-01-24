import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the OpenAI module before importing the service
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: vi.fn(),
        },
      },
    })),
  };
});

// Mock config
vi.mock('../../../src/utils/config.js', () => ({
  config: {
    openaiApiKey: '',
  },
}));

describe('transcriptionService', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isAvailable', () => {
    it('returns false when OPENAI_API_KEY is not set', async () => {
      vi.doMock('../../../src/utils/config.js', () => ({
        config: { openaiApiKey: '' },
      }));

      const { transcriptionService } = await import('../../../src/services/transcription.js');
      expect(transcriptionService.isAvailable()).toBe(false);
    });

    it('returns true when OPENAI_API_KEY is set', async () => {
      vi.doMock('../../../src/utils/config.js', () => ({
        config: { openaiApiKey: 'sk-test-key' },
      }));

      const { transcriptionService } = await import('../../../src/services/transcription.js');
      expect(transcriptionService.isAvailable()).toBe(true);
    });
  });

  describe('transcribe', () => {
    it('throws error when OpenAI API key is not configured', async () => {
      vi.doMock('../../../src/utils/config.js', () => ({
        config: { openaiApiKey: '' },
      }));

      const { transcriptionService } = await import('../../../src/services/transcription.js');
      const buffer = Buffer.from('test audio data');

      await expect(transcriptionService.transcribe(buffer, 'audio/webm')).rejects.toThrow(
        'OpenAI API key not configured'
      );
    });

    it('calls OpenAI transcription API with correct parameters', async () => {
      const mockCreate = vi.fn().mockResolvedValue({ text: 'Hello, world!' });

      vi.doMock('openai', () => ({
        default: vi.fn().mockImplementation(() => ({
          audio: {
            transcriptions: {
              create: mockCreate,
            },
          },
        })),
      }));

      vi.doMock('../../../src/utils/config.js', () => ({
        config: { openaiApiKey: 'sk-test-key' },
      }));

      const { transcriptionService } = await import('../../../src/services/transcription.js');
      const buffer = Buffer.from('test audio data');
      const result = await transcriptionService.transcribe(buffer, 'audio/webm');

      expect(result).toBe('Hello, world!');
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'whisper-1',
        file: expect.any(File),
      });
    });

    it('propagates OpenAI API errors', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('OpenAI API rate limit exceeded'));

      vi.doMock('openai', () => ({
        default: vi.fn().mockImplementation(() => ({
          audio: {
            transcriptions: {
              create: mockCreate,
            },
          },
        })),
      }));

      vi.doMock('../../../src/utils/config.js', () => ({
        config: { openaiApiKey: 'sk-test-key' },
      }));

      const { transcriptionService } = await import('../../../src/services/transcription.js');
      const buffer = Buffer.from('test audio data');

      await expect(transcriptionService.transcribe(buffer, 'audio/webm')).rejects.toThrow(
        'OpenAI API rate limit exceeded'
      );
    });
  });
});
