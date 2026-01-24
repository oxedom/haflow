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
  const animationFrameRef = useRef<number | null>(null);

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
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(avg / 255);
          animationFrameRef.current = requestAnimationFrame(updateLevel);
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
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
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
  }, [options]);

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
