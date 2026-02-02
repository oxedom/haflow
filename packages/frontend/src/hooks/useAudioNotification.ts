import { useEffect, useCallback, useRef } from 'react';
import { AudioNotificationManager } from '../services/AudioNotificationManager';
import { AudioCompatibility } from '../utils/AudioCompatibility';

interface AudioNotificationConfig {
  enabled: boolean;
  volume: number;
  highPrioritySound: string;
  standardPrioritySound: string;
  lowPrioritySound: string;
}

const defaultConfig: AudioNotificationConfig = {
  enabled: true,
  volume: 50,
  highPrioritySound: 'alert-urgent.wav',
  standardPrioritySound: 'alert-standard.wav',
  lowPrioritySound: 'alert-low.wav',
};

export function useAudioNotification(config: Partial<AudioNotificationConfig> = {}) {
  const audioManagerRef = useRef<AudioNotificationManager | null>(null);
  const configRef = useRef({ ...defaultConfig, ...config });
  const isInitializedRef = useRef(false);

  // Initialize audio manager
  useEffect(() => {
    if (!isInitializedRef.current && AudioCompatibility.isBrowserSupported()) {
      const manager = new AudioNotificationManager({
        audioAssetsUrl: '/audio',
        preloadSounds: true,
        debounceInterval: 2000,
        enableLogging: false,
      });

      manager.initialize().then(() => {
        // Preload sounds
        manager.preloadSounds([
          configRef.current.highPrioritySound,
          configRef.current.standardPrioritySound,
          configRef.current.lowPrioritySound,
        ]);
      });

      audioManagerRef.current = manager;
      isInitializedRef.current = true;
    }

    return () => {
      // Cleanup on unmount
      if (audioManagerRef.current) {
        audioManagerRef.current.destroy();
        audioManagerRef.current = null;
        isInitializedRef.current = false;
      }
    };
  }, []);

  const playNotification = useCallback(
    (priority: 'high' | 'standard' | 'low' = 'standard') => {
      if (!configRef.current.enabled) return;

      const manager = audioManagerRef.current;
      if (!manager) return;

      const soundMap = {
        high: configRef.current.highPrioritySound,
        standard: configRef.current.standardPrioritySound,
        low: configRef.current.lowPrioritySound,
      };

      const soundId = soundMap[priority];
      manager.play(soundId, configRef.current.volume, priority);
    },
    []
  );

  const setVolume = useCallback((volume: number) => {
    configRef.current.volume = Math.min(Math.max(volume, 0), 100);
    const manager = audioManagerRef.current;
    if (manager) {
      manager.setVolume(configRef.current.volume);
    }
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    configRef.current.enabled = enabled;
  }, []);

  const playPreviewSound = useCallback(async (priority: 'high' | 'standard' | 'low' = 'standard') => {
    const manager = audioManagerRef.current;
    if (!manager) return;

    const soundMap = {
      high: configRef.current.highPrioritySound,
      standard: configRef.current.standardPrioritySound,
      low: configRef.current.lowPrioritySound,
    };

    const soundId = soundMap[priority];
    try {
      await manager.playPreviewSound(soundId, configRef.current.volume);
    } catch (error) {
      console.error('Failed to play preview sound:', error);
    }
  }, []);

  return {
    playNotification,
    setVolume,
    setEnabled,
    playPreviewSound,
    isSupported: AudioCompatibility.isBrowserSupported(),
    config: configRef.current,
  };
}
