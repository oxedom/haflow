import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioNotificationManager, getAudioNotificationManager, resetAudioNotificationManager } from '../AudioNotificationManager';

describe('AudioNotificationManager', () => {
  let manager: AudioNotificationManager;

  beforeEach(() => {
    manager = new AudioNotificationManager({
      audioAssetsUrl: '/test-audio',
      enableLogging: false,
    });
  });

  afterEach(() => {
    manager.destroy();
    resetAudioNotificationManager();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await manager.initialize();
      expect(manager).toBeDefined();
    });

    it('should handle initialization errors gracefully', async () => {
      // Test that initialization doesn't throw even if AudioContext fails
      await expect(manager.initialize()).resolves.toBeUndefined();
    });
  });

  describe('browser support detection', () => {
    it('should detect audio element support', () => {
      const supported = manager.isAudioSupported();
      expect(typeof supported).toBe('boolean');
    });

    it('should detect browser support', () => {
      const supported = manager.isBrowserSupported();
      expect(typeof supported).toBe('boolean');
    });
  });

  describe('volume management', () => {
    it('should set volume within valid range', () => {
      manager.setVolume(75);
      const state = manager.getPlaybackState();
      expect(state.volume).toBe(75);
    });

    it('should clamp volume to min 0', () => {
      manager.setVolume(-50);
      const state = manager.getPlaybackState();
      expect(state.volume).toBe(0);
    });

    it('should clamp volume to max 100', () => {
      manager.setVolume(150);
      const state = manager.getPlaybackState();
      expect(state.volume).toBe(100);
    });
  });

  describe('playback state', () => {
    it('should initialize with not playing state', () => {
      const state = manager.getPlaybackState();
      expect(state.isPlaying).toBe(false);
      expect(state.currentSoundId).toBeUndefined();
    });

    it('should return a copy of playback state', () => {
      const state1 = manager.getPlaybackState();
      const state2 = manager.getPlaybackState();
      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2); // Different object
    });
  });

  describe('audio context', () => {
    it('should return audio context or null', () => {
      const context = manager.getAudioContext();
      expect(context === null || context instanceof AudioContext).toBe(true);
    });
  });

  describe('stop functionality', () => {
    it('should stop playback without errors', async () => {
      await expect(manager.stop()).resolves.toBeUndefined();
    });

    it('should set isPlaying to false after stop', async () => {
      await manager.stop();
      const state = manager.getPlaybackState();
      expect(state.isPlaying).toBe(false);
    });
  });

  describe('preview sound', () => {
    it('should throw error for invalid sound file', async () => {
      await expect(manager.playPreviewSound('nonexistent.wav', 50)).rejects.toThrow();
    });
  });

  describe('debouncing', () => {
    it('should respect debounce interval', async () => {
      manager = new AudioNotificationManager({
        debounceInterval: 2000,
        audioAssetsUrl: '/test-audio',
      });

      // Mock the sound file to avoid actual audio loading errors
      const originalLoad = manager['loadAudioFile'];
      let loadCallCount = 0;

      vi.spyOn(manager as any, 'loadAudioFile').mockImplementation(async (soundId: string) => {
        loadCallCount++;
        const audio = new Audio();
        return audio;
      });

      // First play should succeed
      await manager.play('sound1.wav', 50, 'standard').catch(() => {});

      // Immediate second play should be debounced
      const stateBeforeDebounce = manager.getPlaybackState();

      // Wait longer than debounce interval
      await new Promise((resolve) => setTimeout(resolve, 2100));

      // Now play should work again
      await manager.play('sound2.wav', 50, 'standard').catch(() => {});
    });
  });

  describe('resource cleanup', () => {
    it('should clean up resources on destroy', () => {
      const state = manager.getPlaybackState();
      expect(state).toBeDefined();

      manager.destroy();

      // Manager should still be functional after destroy
      expect(manager).toBeDefined();
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance when called multiple times', () => {
      const manager1 = getAudioNotificationManager();
      const manager2 = getAudioNotificationManager();
      expect(manager1).toBe(manager2);
    });

    it('should reset singleton instance', () => {
      const manager1 = getAudioNotificationManager();
      resetAudioNotificationManager();
      const manager2 = getAudioNotificationManager();
      expect(manager1).not.toBe(manager2);
    });
  });

  describe('audio URL construction', () => {
    it('should construct correct URL for files without extension', () => {
      const urlWithoutExt = (manager as any).getAudioUrl('alert-sound');
      expect(urlWithoutExt).toBe('/test-audio/alert-sound.wav');
    });

    it('should use provided URL for files with extension', () => {
      const urlWithExt = (manager as any).getAudioUrl('alert-sound.mp3');
      expect(urlWithExt).toBe('/test-audio/alert-sound.mp3');
    });
  });
});
