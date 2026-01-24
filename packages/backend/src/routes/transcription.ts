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
