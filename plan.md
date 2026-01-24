# Whisper Voice Transcription Feature Plan

## Overview
Add OpenAI Whisper voice-to-text transcription with:
- Backend proxy (API key server-side)
- Toggle recording mode (click to start/stop)
- Voice button in NewMissionModal + new ChatVoice component

---

## Phase 1: Backend

### 1.1 Add Dependencies
**File:** `packages/backend/package.json`
```bash
pnpm --filter @haflow/backend add openai multer
pnpm --filter @haflow/backend add -D @types/multer
```

### 1.2 Add Config Entry
**File:** `packages/backend/src/utils/config.ts`
```typescript
export const config = {
  // ... existing entries
  openaiApiKey: process.env.OPENAI_API_KEY || '',
};
```

### 1.3 Create Transcription Service
**New file:** `packages/backend/src/services/transcription.ts`

Follow existing service pattern (see `mission-store.ts:239-254`):
```typescript
import OpenAI from 'openai';
import { config } from '../utils/config.js';

function createClient(): OpenAI | null {
  if (!config.openaiApiKey) return null;
  return new OpenAI({ apiKey: config.openaiApiKey });
}

async function transcribe(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const client = createClient();
  if (!client) throw new Error('OpenAI API key not configured');

  const file = new File([audioBuffer], 'audio.webm', { type: mimeType });
  const response = await client.audio.transcriptions.create({
    model: 'whisper-1',
    file,
  });
  return response.text;
}

function isAvailable(): boolean {
  return !!config.openaiApiKey;
}

// Export as object (matches codebase pattern)
export const transcriptionService = {
  transcribe,
  isAvailable,
};
```

### 1.4 Create Transcription Routes
**New file:** `packages/backend/src/routes/transcription.ts`

Use `sendSuccess`/`sendError` helpers (see `utils/response.ts`):
```typescript
import { Router, type Router as RouterType } from 'express';
import multer from 'multer';
import { transcriptionService } from '../services/transcription.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const transcriptionRoutes: RouterType = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// POST /api/transcribe - Transcribe audio file
transcriptionRoutes.post('/', upload.single('audio'), async (req, res, next) => {
  try {
    if (!req.file) {
      return sendError(res, 'No audio file provided', 400);
    }

    const text = await transcriptionService.transcribe(req.file.buffer, req.file.mimetype);
    sendSuccess(res, { text });
  } catch (err) {
    next(err);
  }
});

// GET /api/transcribe/status - Check if transcription is available
transcriptionRoutes.get('/status', async (_req, res, next) => {
  try {
    sendSuccess(res, { available: transcriptionService.isAvailable() });
  } catch (err) {
    next(err);
  }
});
```

### 1.5 Register Routes
**File:** `packages/backend/src/server.ts`
```typescript
import { transcriptionRoutes } from './routes/transcription.js';

// Add after existing route registration (line ~11):
app.use('/api/transcribe', transcriptionRoutes);
```

---

## Phase 2: Shared Types

### 2.1 Add Schemas
**File:** `packages/shared/src/schemas.ts`
```typescript
// Add at end of file:
export const TranscriptionResponseSchema = z.object({
  text: z.string(),
});

export const TranscriptionStatusSchema = z.object({
  available: z.boolean(),
});
```

### 2.2 Add Type Exports
**File:** `packages/shared/src/types.ts`
```typescript
// Add to imports:
import {
  // ... existing imports
  TranscriptionResponseSchema,
  TranscriptionStatusSchema,
} from './schemas.js';

// Add to type exports:
export type TranscriptionResponse = z.infer<typeof TranscriptionResponseSchema>;
export type TranscriptionStatus = z.infer<typeof TranscriptionStatusSchema>;
```

### 2.3 Rebuild Shared Package
```bash
pnpm --filter @haflow/shared build
```

---

## Phase 3: Frontend - Core

### 3.1 Extend API Client
**File:** `packages/frontend/src/api/client.ts`

Add methods using FormData for file upload:
```typescript
import type { TranscriptionResponse, TranscriptionStatus } from '@haflow/shared';

// Add to api object:
transcribeAudio: async (audioBlob: Blob): Promise<string> => {
  const formData = new FormData();
  formData.append('audio', audioBlob);
  const res = await client.post<ApiResponse<TranscriptionResponse>>(
    '/transcribe',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  if (!res.data.success) throw new Error(res.data.error || 'Transcription failed');
  return res.data.data!.text;
},

getTranscriptionStatus: async (): Promise<TranscriptionStatus> => {
  const res = await client.get<ApiResponse<TranscriptionStatus>>('/transcribe/status');
  if (!res.data.success) throw new Error(res.data.error || 'Failed to get status');
  return res.data.data!;
},
```

### 3.2 Create Voice Recorder Hook
**New directory + file:** `packages/frontend/src/hooks/useVoiceRecorder.ts`

> Note: Create `hooks/` directory first - it doesn't exist yet.

```typescript
import { useState, useRef, useCallback } from 'react';
import { api } from '@/api/client';

type RecorderState = 'idle' | 'recording' | 'processing';

interface UseVoiceRecorderOptions {
  onTranscription?: (text: string) => void;
  onError?: (error: Error) => void;
}

export function useVoiceRecorder(options: UseVoiceRecorderOptions = {}) {
  const [state, setState] = useState<RecorderState>('idle');
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);

      // Check browser support
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Voice recording not supported in this browser');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Set up audio level monitoring
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Monitor audio levels
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      const updateLevel = () => {
        if (analyserRef.current && state === 'recording') {
          analyserRef.current.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(avg / 255);
          requestAnimationFrame(updateLevel);
        }
      };

      // Set up MediaRecorder
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        audioContextRef.current?.close();
        setAudioLevel(0);

        if (chunksRef.current.length > 0) {
          setState('processing');
          try {
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
            const text = await api.transcribeAudio(blob);
            options.onTranscription?.(text);
          } catch (err) {
            const error = err instanceof Error ? err : new Error('Transcription failed');
            setError(error.message);
            options.onError?.(error);
          }
        }
        setState('idle');
      };

      mediaRecorderRef.current.start();
      setState('recording');
      updateLevel();

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to start recording');
      if (error.name === 'NotAllowedError') {
        setError('Microphone permission denied');
      } else {
        setError(error.message);
      }
      options.onError?.(error);
      setState('idle');
    }
  }, [options, state]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, [state]);

  const toggleRecording = useCallback(() => {
    if (state === 'idle') {
      startRecording();
    } else if (state === 'recording') {
      stopRecording();
    }
  }, [state, startRecording, stopRecording]);

  return {
    state,
    isRecording: state === 'recording',
    isProcessing: state === 'processing',
    audioLevel,
    error,
    toggleRecording,
    startRecording,
    stopRecording,
  };
}
```

### 3.3 Create Voice Button Component
**New file:** `packages/frontend/src/components/VoiceRecorderButton.tsx`

```typescript
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { cn } from '@/lib/utils';

interface VoiceRecorderButtonProps {
  onTranscription: (text: string) => void;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  disabled?: boolean;
}

export function VoiceRecorderButton({
  onTranscription,
  size = 'icon',
  className,
  disabled = false,
}: VoiceRecorderButtonProps) {
  const { isRecording, isProcessing, audioLevel, error, toggleRecording } = useVoiceRecorder({
    onTranscription,
  });

  const isDisabled = disabled || isProcessing;

  return (
    <div className="relative inline-flex items-center">
      {/* Audio level ring (visible when recording) */}
      {isRecording && (
        <div
          className="absolute inset-0 rounded-full bg-destructive/20 animate-pulse"
          style={{
            transform: `scale(${1 + audioLevel * 0.5})`,
            transition: 'transform 0.1s ease-out',
          }}
        />
      )}

      <Button
        type="button"
        variant={isRecording ? 'destructive' : 'outline'}
        size={size}
        onClick={toggleRecording}
        disabled={isDisabled}
        className={cn('relative z-10', className)}
        title={error || (isRecording ? 'Stop recording' : 'Start recording')}
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isRecording ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
```

---

## Phase 4: Frontend - NewMissionModal Integration

**File:** `packages/frontend/src/components/NewMissionModal.tsx`

### 4.1 Add Import
```typescript
import { VoiceRecorderButton } from './VoiceRecorderButton';
```

### 4.2 Modify rawInput Section
Find the rawInput `<div className="space-y-2">` section and update:

```tsx
{/* Raw Input with Voice Button */}
<div className="space-y-2">
  <div className="flex items-center justify-between">
    <Label htmlFor="rawInput">Raw Input</Label>
    <VoiceRecorderButton
      onTranscription={(text) => setRawInput(prev => prev ? prev + '\n\n' + text : text)}
      size="sm"
    />
  </div>
  <Textarea
    id="rawInput"
    value={rawInput}
    onChange={(e) => setRawInput(e.target.value)}
    placeholder="Describe the feature/fix in detail, or use the mic button to speak..."
    rows={8}
    className="font-mono text-sm resize-none"
  />
</div>
```

---

## Phase 5: Frontend - ChatVoice Component

**New file:** `packages/frontend/src/components/ChatVoice.tsx`

Features:
- Chat-style message list with scroll area
- User/Assistant/System message bubbles
- Voice input button with audio level visualization
- Text input with Enter to send
- Headphones icon in header
- Voice messages marked with mic icon
- Loading indicator during processing

```typescript
interface ChatVoiceProps {
  onSubmitMessage?: (message: string) => Promise<string | void>;
  title?: string;
  welcomeMessage?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  isVoice?: boolean;
  timestamp: Date;
}
```

Implementation uses:
- `ScrollArea` from `@/components/ui/scroll-area`
- `Card` from `@/components/ui/card`
- `Input` from `@/components/ui/input`
- `Button` from `@/components/ui/button`
- `VoiceRecorderButton` for voice input
- `Headphones`, `Send`, `Mic` icons from lucide-react

---

## Phase 6: App Integration

**File:** `packages/frontend/src/App.tsx`

Add ChatVoice as a standalone demo/test view accessible via a button in the header:

### 6.1 Add State
```typescript
const [showVoiceChat, setShowVoiceChat] = useState(false);
```

### 6.2 Add Toggle Button (in header area)
```tsx
<Button
  variant="outline"
  size="icon"
  onClick={() => setShowVoiceChat(!showVoiceChat)}
  title="Voice Chat"
>
  <Headphones className="h-4 w-4" />
</Button>
```

### 6.3 Conditional Render
```tsx
{showVoiceChat ? (
  <ChatVoice
    title="Voice Chat"
    welcomeMessage="Hello! You can type or use voice input."
    onSubmitMessage={async (msg) => {
      // Echo for demo, or integrate with actual AI endpoint
      return `You said: ${msg}`;
    }}
  />
) : (
  <MissionDetail ... />
)}
```

---

## Files to Create
1. `packages/frontend/src/hooks/` (directory)
2. `packages/backend/src/services/transcription.ts`
3. `packages/backend/src/routes/transcription.ts`
4. `packages/frontend/src/hooks/useVoiceRecorder.ts`
5. `packages/frontend/src/components/VoiceRecorderButton.tsx`
6. `packages/frontend/src/components/ChatVoice.tsx`

## Files to Modify
1. `packages/backend/package.json` - add openai, multer deps
2. `packages/backend/src/utils/config.ts` - add openaiApiKey
3. `packages/backend/src/server.ts` - register routes
4. `packages/shared/src/schemas.ts` - add transcription schemas
5. `packages/shared/src/types.ts` - add type exports
6. `packages/frontend/src/api/client.ts` - add transcribe methods
7. `packages/frontend/src/components/NewMissionModal.tsx` - add voice button
8. `packages/frontend/src/App.tsx` - add ChatVoice toggle

## Environment Variables
```bash
OPENAI_API_KEY=sk-your-key-here
```

---

## UI Design Notes

### Voice Button States
| State | Icon | Color | Effect |
|-------|------|-------|--------|
| Idle | Mic | outline | none |
| Recording | MicOff | destructive | pulse + audio ring |
| Processing | Loader2 | outline | spin |
| Error | Mic | outline | red title tooltip |

### Permission Handling
| Scenario | Behavior |
|----------|----------|
| Browser unsupported | Error: "Voice recording not supported in this browser" |
| Permission denied | Error: "Microphone permission denied" |
| Permission prompt | Browser shows native permission dialog |

### ChatVoice Layout
```
+----------------------------------+
| [Headphones] Voice Chat          |
+----------------------------------+
| [Bot] Welcome message            |
|                                  |
|        [User] Hello! [Mic icon]  |
|                                  |
| [Bot] Response...                |
+----------------------------------+
| [Input field] [Mic] [Send]       |
| [Recording indicator...]         |
+----------------------------------+
```

---

## Success Criteria

### Automated Verification
- [x] Backend builds: `pnpm --filter @haflow/backend build`
- [x] Frontend builds: `pnpm --filter frontend build`
- [x] Shared builds: `pnpm --filter @haflow/shared build`
- [ ] No TypeScript errors: `pnpm --filter frontend lint` (pre-existing lint issues, new code is clean)
- [ ] GET `/api/transcribe/status` returns `{ success: true, data: { available: boolean } }`

### Manual Verification
- [ ] Voice button appears next to "Raw Input" label in NewMissionModal
- [ ] Clicking mic button requests microphone permission
- [ ] Recording shows pulsing animation and audio level ring
- [ ] Stopping recording shows loading spinner during transcription
- [ ] Transcribed text appends to rawInput textarea
- [ ] ChatVoice component accessible via header button
- [ ] Voice and text input both work in ChatVoice
