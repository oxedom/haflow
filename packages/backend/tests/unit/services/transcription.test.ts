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

    it('handles empty transcription response', async () => {
      const mockCreate = vi.fn().mockResolvedValue({ text: '' });

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

      expect(result).toBe('');
    });

    it('handles Unicode and multi-language transcription', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        text: 'Hello 你好 مرحبا שלום Привет 🎤',
      });

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

      expect(result).toBe('Hello 你好 مرحبا שלום Привет 🎤');
    });

    it('handles long transcription text', async () => {
      const longText = 'This is a test sentence. '.repeat(500);
      const mockCreate = vi.fn().mockResolvedValue({ text: longText });

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

      expect(result).toBe(longText);
      expect(result.length).toBeGreaterThan(10000);
    });

    it('handles invalid API key error', async () => {
      const mockCreate = vi.fn().mockRejectedValue(
        new Error('Incorrect API key provided: sk-inva*****. You can find your API key at https://platform.openai.com/account/api-keys.')
      );

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
        config: { openaiApiKey: 'sk-invalid' },
      }));

      const { transcriptionService } = await import('../../../src/services/transcription.js');
      const buffer = Buffer.from('test audio data');

      await expect(transcriptionService.transcribe(buffer, 'audio/webm')).rejects.toThrow(
        'Incorrect API key provided'
      );
    });

    it('handles network timeout error', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('Request timeout'));

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
        'Request timeout'
      );
    });

    it('handles different mime types correctly', async () => {
      const mockCreate = vi.fn().mockResolvedValue({ text: 'transcribed text' });

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

      // Test with different mime types
      await transcriptionService.transcribe(buffer, 'audio/mp4');
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'whisper-1',
        file: expect.objectContaining({ type: 'audio/mp4' }),
      });
    });

    it('handles quota exceeded error', async () => {
      const mockCreate = vi.fn().mockRejectedValue(
        new Error('You exceeded your current quota, please check your plan and billing details.')
      );

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
        'You exceeded your current quota'
      );
    });

    it('handles server error from OpenAI', async () => {
      const mockCreate = vi.fn().mockRejectedValue(
        new Error('The server had an error while processing your request. Sorry about that!')
      );

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
        'The server had an error'
      );
    });
  });
});
