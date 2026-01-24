# Backend Transcription Tests Plan

## Overview

Test plan for the Whisper voice transcription feature added to the backend.

---

## Test Files to Create

```
packages/backend/tests/
├── unit/
│   └── services/
│       └── transcription.test.ts    # Unit tests for transcription service
└── integration/
    └── routes/
        └── transcription.test.ts    # Integration tests for API routes
```

---

## 1. Unit Tests: `tests/unit/services/transcription.test.ts`

**Purpose:** Test the transcription service in isolation with mocked OpenAI client

### Test Cases

```typescript
describe('transcriptionService', () => {
  describe('isAvailable', () => {
    it('returns true when OPENAI_API_KEY is set')
    it('returns false when OPENAI_API_KEY is empty')
    it('returns false when OPENAI_API_KEY is undefined')
  })

  describe('transcribe', () => {
    it('throws error when OpenAI API key is not configured')
    it('calls OpenAI audio.transcriptions.create with correct params')
    it('returns transcribed text from OpenAI response')
    it('passes correct file type based on mimeType')
    it('handles OpenAI API errors gracefully')
  })
})
```

### Mocking Strategy

- Mock `openai` module to avoid real API calls
- Use `vi.stubEnv` to control `OPENAI_API_KEY`
- Verify correct parameters passed to OpenAI SDK

### Implementation Skeleton

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock OpenAI before importing service
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: vi.fn().mockResolvedValue({ text: 'transcribed text' }),
      },
    },
  })),
}));

import { transcriptionService } from '../../../src/services/transcription.js';

describe('transcriptionService', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe('isAvailable', () => {
    it('returns true when OPENAI_API_KEY is set', () => {
      expect(transcriptionService.isAvailable()).toBe(true);
    });
  });

  describe('transcribe', () => {
    it('returns transcribed text from OpenAI response', async () => {
      const buffer = Buffer.from('test audio data');
      const result = await transcriptionService.transcribe(buffer, 'audio/webm');
      expect(result).toBe('transcribed text');
    });
  });
});
```

---

## 2. Integration Tests: `tests/integration/routes/transcription.test.ts`

**Purpose:** Test the full HTTP request/response cycle using supertest

### Test Cases

```typescript
describe('transcription routes', () => {
  describe('GET /api/transcribe/status', () => {
    it('returns { available: true } when API key is configured')
    it('returns { available: false } when API key is not configured')
    it('returns correct ApiResponse wrapper shape')
    it('returns status 200')
  })

  describe('POST /api/transcribe', () => {
    // Error cases
    it('returns 400 when no audio file provided')
    it('returns 400 when file field name is wrong')
    it('rejects files over 25MB size limit')
    it('rejects unsupported mime types (e.g., image/png)')
    it('returns error when API key not configured')
    it('returns 500 when OpenAI API fails')

    // Success cases
    it('accepts audio/webm files')
    it('accepts audio/mp4 files')
    it('accepts audio/mpeg files')
    it('accepts audio/wav files')
    it('accepts audio/ogg files')
    it('returns transcribed text on success')
    it('returns correct ApiResponse wrapper shape')
  })
})
```

### Test Setup

- Use `supertest` to make HTTP requests to Express app
- Create test audio buffers (minimal valid data)
- Mock OpenAI client for controlled responses
- Test with and without `OPENAI_API_KEY` set

### Implementation Skeleton

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createServer } from '../../../src/server.js';

// Mock OpenAI
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: vi.fn().mockResolvedValue({ text: 'Hello world' }),
      },
    },
  })),
}));

describe('transcription routes', () => {
  const app = createServer();

  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', 'test-api-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe('GET /api/transcribe/status', () => {
    it('returns available true when API key is configured', async () => {
      const res = await request(app).get('/api/transcribe/status');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: { available: true },
        error: null,
      });
    });

    it('returns available false when API key is not configured', async () => {
      vi.stubEnv('OPENAI_API_KEY', '');

      const res = await request(app).get('/api/transcribe/status');

      expect(res.status).toBe(200);
      expect(res.body.data.available).toBe(false);
    });
  });

  describe('POST /api/transcribe', () => {
    it('returns 400 when no audio file provided', async () => {
      const res = await request(app)
        .post('/api/transcribe')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('No audio file provided');
    });

    it('returns transcribed text on success', async () => {
      const audioBuffer = Buffer.from('fake audio data');

      const res = await request(app)
        .post('/api/transcribe')
        .attach('audio', audioBuffer, {
          filename: 'test.webm',
          contentType: 'audio/webm',
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: { text: 'Hello world' },
        error: null,
      });
    });

    it('rejects unsupported mime types', async () => {
      const imageBuffer = Buffer.from('fake image data');

      const res = await request(app)
        .post('/api/transcribe')
        .attach('audio', imageBuffer, {
          filename: 'test.png',
          contentType: 'image/png',
        });

      expect(res.status).toBe(400);
    });
  });
});
```

---

## 3. Test Utilities (Optional)

### `tests/utils/audio.ts`

Helper for creating test audio data:

```typescript
/**
 * Creates a minimal buffer that passes mimetype validation
 * Note: This is not valid audio, just for testing file handling
 */
export function createTestAudioBuffer(): Buffer {
  return Buffer.from('test-audio-content');
}

/**
 * Creates a buffer that exceeds the 25MB limit
 */
export function createOversizedBuffer(): Buffer {
  return Buffer.alloc(26 * 1024 * 1024); // 26MB
}
```

---

## 4. Dependencies

### Already Installed
- `vitest` - test runner
- `supertest` - HTTP testing
- `@types/supertest` - TypeScript types

### Mocking
- Use `vi.mock()` for OpenAI SDK
- Use `vi.stubEnv()` for environment variables

---

## 5. Implementation Priority

| Priority | Test File | Rationale |
|----------|-----------|-----------|
| 1 | `unit/services/transcription.test.ts` | Core logic validation, fast feedback |
| 2 | `integration/routes/transcription.test.ts` | API contract validation, E2E flow |

---

## 6. Edge Cases to Cover

### Service Layer
- Empty API key (empty string vs undefined)
- OpenAI SDK throws network error
- OpenAI SDK returns malformed response
- Very large audio buffer handling

### Route Layer
- Missing `audio` field in multipart form
- Wrong field name (e.g., `file` instead of `audio`)
- Empty file upload
- File exactly at 25MB limit
- File slightly over 25MB limit
- Multiple files uploaded (should use first)
- Concurrent requests

---

## 7. Running Tests

```bash
# Run all backend tests
pnpm --filter @haflow/backend test

# Run only transcription tests
pnpm --filter @haflow/backend vitest run tests/unit/services/transcription.test.ts
pnpm --filter @haflow/backend vitest run tests/integration/routes/transcription.test.ts

# Run in watch mode
pnpm --filter @haflow/backend test:watch
```

---

## 8. Success Criteria

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] No mocked API calls leak to real OpenAI
- [ ] Tests run in < 5 seconds (no real network calls)
- [ ] Coverage > 80% for transcription service
- [ ] Coverage > 80% for transcription routes
