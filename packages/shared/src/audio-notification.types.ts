// User preference structure for audio notifications
export interface AudioNotificationPreferences {
  audioNotifications: {
    enabled: boolean;
    volume: number; // 0-100
    profiles: {
      highPriority: {
        sound: string; // sound file ID
        enabled: boolean;
      };
      standardPriority: {
        sound: string;
        enabled: boolean;
      };
      lowPriority: {
        sound: string;
        enabled: boolean;
      };
    };
  };
  visualNotifications: {
    enabled: boolean;
  };
}

// Audio notification event structure
export interface AudioNotificationEvent {
  id: string;
  priority: 'high' | 'standard' | 'low';
  soundId: string;
  timestamp: number;
  userId: string;
  metadata?: Record<string, any>;
}

// Audio playback state
export interface AudioPlaybackState {
  isPlaying: boolean;
  currentSoundId?: string;
  volume: number;
  lastPlayedAt?: number;
}

// Audio asset metadata
export interface AudioAssetMetadata {
  id: string;
  filename: string;
  format: 'mp3' | 'wav';
  hash: string; // SHA-256 for integrity checking
  size: number;
  duration: number; // in milliseconds
  priority: 'high' | 'standard' | 'low';
  preload: boolean;
}

// Audio manager configuration
export interface AudioManagerConfig {
  audioAssetsUrl?: string; // URL to fetch audio files
  preloadSounds?: boolean;
  debounceInterval?: number; // milliseconds
  enableLogging?: boolean;
}

// Cache statistics
export interface CacheStats {
  totalSize: number;
  itemCount: number;
  hitRate: number;
  lastCleanup: number;
}

// Browser compatibility report
export interface BrowserInfo {
  name: string;
  version: string;
  platform: string;
}

export interface CompatibilityReport {
  isFullySupported: boolean;
  audioElement: boolean;
  webAudioAPI: boolean;
  serviceWorker: boolean;
  permissionsAPI: boolean;
  supportedFormats: string[];
  warnings: string[];
}

// Audio error handling
export enum AudioErrorType {
  AUTOPLAY_BLOCKED = 'autoplay_blocked',
  FILE_NOT_FOUND = 'file_not_found',
  NETWORK_ERROR = 'network_error',
  NO_AUDIO_CONTEXT = 'no_audio_context',
  UNSUPPORTED_FORMAT = 'unsupported_format',
  CACHE_FULL = 'cache_full',
  PERMISSIONS_DENIED = 'permissions_denied',
  UNKNOWN = 'unknown',
}

export interface AudioErrorContext {
  errorType: AudioErrorType;
  soundId?: string;
  originalError?: Error;
  timestamp: number;
}

export interface RecoveryStrategy {
  action: 'SHOW_VISUAL_ONLY' | 'FALLBACK_SOUND' | 'RETRY_WITH_BACKOFF' | 'SILENT_FAILURE';
  message?: string;
  userAction?: string;
  fallback?: string;
  maxRetries?: number;
  initialDelayMs?: number;
}

export interface AudioErrorResponse {
  success: boolean;
  error: AudioErrorType;
  recovery: RecoveryStrategy;
  userMessage?: string;
}
