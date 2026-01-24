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

### 1.2 Create Transcription Service
**New file:** `packages/backend/src/services/transcription.ts`
- Initialize OpenAI client with `OPENAI_API_KEY` env var
- `transcribe(audioBuffer, mimeType)` method
- Return transcribed text string

### 1.3 Create Transcription Routes
**New file:** `packages/backend/src/routes/transcription.ts`
- `POST /api/transcribe` - Receive audio file via multer, return transcribed text
- `GET /api/transcribe/status` - Check if API key configured
- 25MB file limit, validate audio MIME types

### 1.4 Register Routes
**File:** `packages/backend/src/server.ts` (line 11)
```typescript
import { transcriptionRoutes } from './routes/transcription.js';
// Add: app.use('/api/transcribe', transcriptionRoutes);
```

---

## Phase 2: Shared Types

**File:** `packages/shared/src/schemas.ts`
```typescript
export const TranscriptionResponseSchema = z.object({
  text: z.string(),
});
export const TranscriptionStatusSchema = z.object({
  available: z.boolean(),
});
```

**File:** `packages/shared/src/types.ts`
- Export inferred types

---

## Phase 3: Frontend - Core

### 3.1 Extend API Client
**File:** `packages/frontend/src/api/client.ts`
```typescript
transcribeAudio: async (audioBlob: Blob): Promise<string>
getTranscriptionStatus: async (): Promise<TranscriptionStatus>
```

### 3.2 Create Voice Recorder Hook
**New file:** `packages/frontend/src/hooks/useVoiceRecorder.ts`
- States: `idle` | `recording` | `processing`
- Uses MediaRecorder API + Web Audio API for level visualization
- Returns: `toggleRecording`, `isRecording`, `isProcessing`, `audioLevel`

### 3.3 Create Voice Button Component
**New file:** `packages/frontend/src/components/VoiceRecorderButton.tsx`
- Mic/MicOff icons from lucide-react
- Pulsing animation + audio level ring when recording
- Loading spinner when processing

---

## Phase 4: Frontend - NewMissionModal Integration

**File:** `packages/frontend/src/components/NewMissionModal.tsx`

Changes at lines 101-112:
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
  <Textarea ... placeholder="...or use the mic button to speak" />
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

Props:
```typescript
interface ChatVoiceProps {
  onSubmitMessage?: (message: string) => Promise<string | void>;
  title?: string;
  welcomeMessage?: string;
}
```

---

## Phase 6: App Integration (Optional)

**File:** `packages/frontend/src/App.tsx`

Add toggle or route for ChatVoice view alongside existing mission detail.

---

## Files to Create
1. `packages/backend/src/services/transcription.ts`
2. `packages/backend/src/routes/transcription.ts`
3. `packages/frontend/src/hooks/useVoiceRecorder.ts`
4. `packages/frontend/src/components/VoiceRecorderButton.tsx`
5. `packages/frontend/src/components/ChatVoice.tsx`

## Files to Modify
1. `packages/backend/package.json` - add openai, multer deps
2. `packages/backend/src/server.ts` - register routes
3. `packages/shared/src/schemas.ts` - add transcription schemas
4. `packages/shared/src/types.ts` - export types
5. `packages/frontend/src/api/client.ts` - add transcribe methods
6. `packages/frontend/src/components/NewMissionModal.tsx` - add voice button

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
