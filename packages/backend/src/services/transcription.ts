import OpenAI from 'openai';
import { config } from '../utils/config.js';

function createClient(): OpenAI | null {
  if (!config.openaiApiKey) return null;
  return new OpenAI({ apiKey: config.openaiApiKey });
}

async function transcribe(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const client = createClient();
  if (!client) throw new Error('OpenAI API key not configured');

  // Convert Buffer to ArrayBuffer for File constructor (Node.js TypeScript quirk)
  const arrayBuffer = audioBuffer.buffer.slice(
    audioBuffer.byteOffset,
    audioBuffer.byteOffset + audioBuffer.byteLength
  ) as ArrayBuffer;
  const file = new File([arrayBuffer], 'audio.webm', { type: mimeType });
  const response = await client.audio.transcriptions.create({
    model: 'whisper-1',
    file,
  });
  return response.text;
}

function isAvailable(): boolean {
  return !!config.openaiApiKey;
}

export const transcriptionService = {
  transcribe,
  isAvailable,
};
