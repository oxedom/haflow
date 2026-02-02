import type {
  AudioManagerConfig,
  AudioNotificationEvent,
  AudioPlaybackState,
} from '@haflow/shared';

export class AudioNotificationManager {
  private audioCache: Map<string, HTMLAudioElement>;
  private playbackQueue: AudioNotificationEvent[];
  private currentPlayback?: {
    sound: HTMLAudioElement;
    soundId: string;
    startTime: number;
  };
  private lastPlayedTime: number = 0;
  private debounceInterval: number = 2000; // ms
  private audioContext: AudioContext | null = null;
  private playbackState: AudioPlaybackState;
  private config: AudioManagerConfig;

  constructor(config: AudioManagerConfig = {}) {
    this.audioCache = new Map();
    this.playbackQueue = [];
    this.config = {
      audioAssetsUrl: config.audioAssetsUrl || '/audio',
      preloadSounds: config.preloadSounds !== false,
      debounceInterval: config.debounceInterval || 2000,
      enableLogging: config.enableLogging || false,
      ...config,
    };
    this.debounceInterval = this.config.debounceInterval || 2000;
    this.playbackState = {
      isPlaying: false,
      volume: 50,
    };
  }

  // Public methods
  async initialize(): Promise<void> {
    try {
      // Try to create AudioContext
      if (this.isBrowserSupported()) {
        const audioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new audioContextClass();
        this.log('AudioContext initialized');
      }
    } catch (error) {
      this.logError('Failed to initialize AudioContext', error as Error);
      // Continue without Web Audio API
    }
  }

  async play(soundId: string, volume: number, priority: string = 'standard'): Promise<void> {
    try {
      // Check if debounce prevents playback
      if (this.debouncePlayback(priority)) {
        this.log(`Playback debounced for ${soundId}`);
        return;
      }

      // Update last played time
      this.lastPlayedTime = Date.now();

      // If already playing, stop first
      if (this.currentPlayback) {
        await this.stop();
      }

      // Load and play sound
      const sound = await this.loadAudioFile(soundId);
      sound.volume = Math.min(Math.max(volume / 100, 0), 1); // Ensure 0-1 range

      this.currentPlayback = {
        sound,
        soundId,
        startTime: Date.now(),
      };

      this.playbackState.isPlaying = true;
      this.playbackState.currentSoundId = soundId;
      this.playbackState.volume = volume;
      this.playbackState.lastPlayedAt = Date.now();

      // Play the sound
      const playPromise = sound.play();
      if (playPromise !== undefined) {
        playPromise.catch((error: Error) => {
          this.handlePlaybackError(error, soundId);
        });
      }

      // Set up cleanup when audio ends
      sound.addEventListener('ended', () => this.cleanupAudioResources(), { once: true });

      this.log(`Playing sound: ${soundId} at volume ${volume}%`);
    } catch (error) {
      this.handlePlaybackError(error as Error, soundId);
    }
  }

  async stop(): Promise<void> {
    if (this.currentPlayback) {
      try {
        this.currentPlayback.sound.pause();
        this.currentPlayback.sound.currentTime = 0;
        this.playbackState.isPlaying = false;
        this.playbackState.currentSoundId = undefined;
        this.log('Playback stopped');
      } catch (error) {
        this.logError('Error stopping playback', error as Error);
      }
    }
  }

  async preloadSounds(soundIds: string[]): Promise<void> {
    try {
      for (const soundId of soundIds) {
        if (!this.audioCache.has(soundId)) {
          await this.loadAudioFile(soundId);
        }
      }
      this.log(`Preloaded ${soundIds.length} sounds`);
    } catch (error) {
      this.logError('Error preloading sounds', error as Error);
    }
  }

  setVolume(volume: number): void {
    const normalizedVolume = Math.min(Math.max(volume, 0), 100);
    this.playbackState.volume = normalizedVolume;

    if (this.currentPlayback) {
      this.currentPlayback.sound.volume = normalizedVolume / 100;
    }

    this.log(`Volume set to ${normalizedVolume}%`);
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  isAudioSupported(): boolean {
    return typeof HTMLAudioElement !== 'undefined';
  }

  isBrowserSupported(): boolean {
    const hasAudioElement = this.isAudioSupported();
    const hasWebAudio = !!(window.AudioContext || (window as any).webkitAudioContext);
    return hasAudioElement && hasWebAudio;
  }

  getPlaybackState(): AudioPlaybackState {
    return { ...this.playbackState };
  }

  async playPreviewSound(soundId: string, volume: number): Promise<void> {
    try {
      const sound = await this.loadAudioFile(soundId);
      sound.volume = Math.min(Math.max(volume / 100, 0), 1);

      const playPromise = sound.play();
      if (playPromise !== undefined) {
        playPromise.catch((error: Error) => {
          this.logError(`Preview sound playback failed for ${soundId}`, error);
        });
      }

      this.log(`Preview sound playing: ${soundId}`);
    } catch (error) {
      this.logError(`Failed to play preview sound ${soundId}`, error as Error);
      throw error;
    }
  }

  // Private methods
  private async loadAudioFile(soundId: string): Promise<HTMLAudioElement> {
    // Check cache first
    if (this.audioCache.has(soundId)) {
      return this.audioCache.get(soundId)!;
    }

    try {
      // Create audio element
      const audio = new Audio();

      // Construct URL (handle both .mp3 and .wav extensions)
      const audioUrl = this.getAudioUrl(soundId);
      audio.src = audioUrl;
      audio.crossOrigin = 'anonymous';

      // Wait for audio to load
      await new Promise<void>((resolve, reject) => {
        const handleCanPlay = () => {
          audio.removeEventListener('canplay', handleCanPlay);
          audio.removeEventListener('error', handleError);
          resolve();
        };

        const handleError = () => {
          audio.removeEventListener('canplay', handleCanPlay);
          audio.removeEventListener('error', handleError);
          reject(new Error(`Failed to load audio: ${audioUrl}`));
        };

        audio.addEventListener('canplay', handleCanPlay, { once: true });
        audio.addEventListener('error', handleError, { once: true });

        // Set a timeout for loading
        setTimeout(() => {
          audio.removeEventListener('canplay', handleCanPlay);
          audio.removeEventListener('error', handleError);
          reject(new Error(`Audio loading timeout: ${soundId}`));
        }, 10000);
      });

      // Cache the audio element
      this.audioCache.set(soundId, audio);
      this.log(`Audio loaded and cached: ${soundId}`);

      return audio;
    } catch (error) {
      this.logError(`Failed to load audio file: ${soundId}`, error as Error);
      throw error;
    }
  }

  private getAudioUrl(soundId: string): string {
    // If soundId already has an extension, use it directly
    if (soundId.includes('.')) {
      return `${this.config.audioAssetsUrl}/${soundId}`;
    }

    // Try common extensions
    return `${this.config.audioAssetsUrl}/${soundId}.wav`;
  }

  private isAutoplayAllowed(): boolean {
    // Check if we can play audio (autoplay might be blocked)
    return true; // Trust the browser to tell us via error on play()
  }

  private handlePlaybackError(error: Error, soundId: string): void {
    const errorMessage = error.message || error.toString();

    if (errorMessage.includes('NotAllowedError') || errorMessage.includes('autoplay')) {
      this.log(`Autoplay blocked for ${soundId}`);
    } else if (errorMessage.includes('NotFoundError')) {
      this.logError(`Audio file not found: ${soundId}`, error);
    } else {
      this.logError(`Playback error for ${soundId}`, error);
    }

    this.playbackState.isPlaying = false;
    this.playbackState.currentSoundId = undefined;
  }

  private debouncePlayback(priority: string): boolean {
    const now = Date.now();
    const timeSinceLastPlay = now - this.lastPlayedTime;

    if (timeSinceLastPlay < this.debounceInterval) {
      return true;
    }

    return false;
  }

  private cleanupAudioResources(): void {
    if (this.currentPlayback) {
      try {
        this.currentPlayback.sound.pause();
        this.currentPlayback.sound.currentTime = 0;
      } catch (error) {
        this.logError('Error during cleanup', error as Error);
      }
    }

    this.playbackState.isPlaying = false;
    this.playbackState.currentSoundId = undefined;
    this.currentPlayback = undefined;

    this.log('Audio resources cleaned up');
  }

  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(`[AudioNotificationManager] ${message}`);
    }
  }

  private logError(message: string, error: Error): void {
    if (this.config.enableLogging) {
      console.error(`[AudioNotificationManager] ${message}`, error);
    }
  }

  // Cleanup on instance destruction
  destroy(): void {
    this.stop();
    this.audioCache.clear();
    this.playbackQueue = [];
    this.currentPlayback = undefined;
  }
}

// Singleton instance
let instance: AudioNotificationManager | null = null;

export function getAudioNotificationManager(
  config?: AudioManagerConfig
): AudioNotificationManager {
  if (!instance) {
    instance = new AudioNotificationManager(config);
  }
  return instance;
}

export function resetAudioNotificationManager(): void {
  if (instance) {
    instance.destroy();
  }
  instance = null;
}
