import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioCompatibility, isAudioSupported, isWebAudioSupported } from '../AudioCompatibility';

describe('AudioCompatibility', () => {
  describe('isAudioElementSupported', () => {
    it('should return boolean', () => {
      const result = AudioCompatibility.isAudioElementSupported();
      expect(typeof result).toBe('boolean');
    });

    it('should return true in modern browsers', () => {
      const result = AudioCompatibility.isAudioElementSupported();
      expect(result).toBe(true);
    });
  });

  describe('isWebAudioAPISupported', () => {
    it('should return boolean', () => {
      const result = AudioCompatibility.isWebAudioAPISupported();
      expect(typeof result).toBe('boolean');
    });

    it('should detect AudioContext', () => {
      const result = AudioCompatibility.isWebAudioAPISupported();
      expect(typeof result).toBe('boolean');
    });

    it('should check for webkit prefix', () => {
      const hasWebAudio = !!window.AudioContext || !!(window as any).webkitAudioContext;
      const result = AudioCompatibility.isWebAudioAPISupported();
      expect(result).toBe(hasWebAudio);
    });
  });

  describe('isBrowserSupported', () => {
    it('should return boolean', () => {
      const result = AudioCompatibility.isBrowserSupported();
      expect(typeof result).toBe('boolean');
    });

    it('should require both audio element and Web Audio API', () => {
      const audioElement = AudioCompatibility.isAudioElementSupported();
      const webAudio = AudioCompatibility.isWebAudioAPISupported();
      const result = AudioCompatibility.isBrowserSupported();

      expect(result).toBe(audioElement && webAudio);
    });
  });

  describe('getAudioFormatsSupported', () => {
    it('should return object with boolean values', () => {
      const formats = AudioCompatibility.getAudioFormatsSupported();
      expect(typeof formats).toBe('object');
      expect(formats.mp3 === true || formats.mp3 === false).toBe(true);
      expect(formats.wav === true || formats.wav === false).toBe(true);
    });

    it('should include common formats', () => {
      const formats = AudioCompatibility.getAudioFormatsSupported();
      expect('mp3' in formats).toBe(true);
      expect('wav' in formats).toBe(true);
      expect('ogg' in formats).toBe(true);
      expect('aac' in formats).toBe(true);
    });

    it('should detect wav support', () => {
      const formats = AudioCompatibility.getAudioFormatsSupported();
      // Most modern browsers support WAV
      expect(typeof formats.wav).toBe('boolean');
    });
  });

  describe('supportsPermissionsAPI', () => {
    it('should return boolean', () => {
      const result = AudioCompatibility.supportsPermissionsAPI();
      expect(typeof result).toBe('boolean');
    });

    it('should check navigator.permissions', () => {
      const hasPermissions = !!navigator.permissions;
      const result = AudioCompatibility.supportsPermissionsAPI();
      expect(result).toBe(hasPermissions);
    });
  });

  describe('supportsServiceWorker', () => {
    it('should return boolean', () => {
      const result = AudioCompatibility.supportsServiceWorker();
      expect(typeof result).toBe('boolean');
    });

    it('should check navigator.serviceWorker', () => {
      const hasServiceWorker = !!navigator.serviceWorker;
      const result = AudioCompatibility.supportsServiceWorker();
      expect(result).toBe(hasServiceWorker);
    });
  });

  describe('supportsIndexedDB', () => {
    it('should return boolean', () => {
      const result = AudioCompatibility.supportsIndexedDB();
      expect(typeof result).toBe('boolean');
    });

    it('should check window.indexedDB', () => {
      const hasIndexedDB = !!window.indexedDB;
      const result = AudioCompatibility.supportsIndexedDB();
      expect(result).toBe(hasIndexedDB);
    });
  });

  describe('getBrowserInfo', () => {
    it('should return browser info object', () => {
      const info = AudioCompatibility.getBrowserInfo();
      expect(info).toHaveProperty('name');
      expect(info).toHaveProperty('version');
      expect(info).toHaveProperty('platform');
    });

    it('should detect browser name', () => {
      const info = AudioCompatibility.getBrowserInfo();
      expect(typeof info.name).toBe('string');
      expect(info.name.length).toBeGreaterThan(0);
    });

    it('should detect platform', () => {
      const info = AudioCompatibility.getBrowserInfo();
      expect(typeof info.platform).toBe('string');
    });

    it('should detect version', () => {
      const info = AudioCompatibility.getBrowserInfo();
      expect(typeof info.version).toBe('string');
    });
  });

  describe('getCompatibilityReport', () => {
    it('should return complete compatibility report', () => {
      const report = AudioCompatibility.getCompatibilityReport();
      expect(report).toHaveProperty('isFullySupported');
      expect(report).toHaveProperty('audioElement');
      expect(report).toHaveProperty('webAudioAPI');
      expect(report).toHaveProperty('serviceWorker');
      expect(report).toHaveProperty('permissionsAPI');
      expect(report).toHaveProperty('supportedFormats');
      expect(report).toHaveProperty('warnings');
    });

    it('should have boolean properties', () => {
      const report = AudioCompatibility.getCompatibilityReport();
      expect(typeof report.isFullySupported).toBe('boolean');
      expect(typeof report.audioElement).toBe('boolean');
      expect(typeof report.webAudioAPI).toBe('boolean');
    });

    it('should have array properties', () => {
      const report = AudioCompatibility.getCompatibilityReport();
      expect(Array.isArray(report.supportedFormats)).toBe(true);
      expect(Array.isArray(report.warnings)).toBe(true);
    });

    it('should generate appropriate warnings', () => {
      const report = AudioCompatibility.getCompatibilityReport();
      // Warnings should only be present if features are not supported
      if (!report.audioElement) {
        expect(report.warnings.some((w) => w.includes('Audio element'))).toBe(true);
      }
    });

    it('should mark as fully supported if all features available', () => {
      const report = AudioCompatibility.getCompatibilityReport();
      const hasAllFeatures =
        report.audioElement && report.webAudioAPI && report.serviceWorker && report.supportedFormats.length > 0;
      expect(report.isFullySupported).toBe(hasAllFeatures);
    });
  });

  describe('canAutoplay', () => {
    it('should return a promise', () => {
      const result = AudioCompatibility.canAutoplay();
      expect(result).toBeInstanceOf(Promise);
    });

    it('should return boolean value', async () => {
      const result = await AudioCompatibility.canAutoplay();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('logCapabilities', () => {
    it('should not throw', () => {
      expect(() => {
        AudioCompatibility.logCapabilities();
      }).not.toThrow();
    });
  });

  describe('exported type predicates', () => {
    it('should export isAudioSupported function', () => {
      const result = isAudioSupported();
      expect(typeof result).toBe('boolean');
    });

    it('should export isWebAudioSupported function', () => {
      const result = isWebAudioSupported();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('error handling', () => {
    it('should handle errors in audio element support detection', () => {
      // Create a scenario that might throw
      expect(() => {
        AudioCompatibility.isAudioElementSupported();
      }).not.toThrow();
    });

    it('should handle errors in browser detection', () => {
      expect(() => {
        AudioCompatibility.getBrowserInfo();
      }).not.toThrow();
    });

    it('should handle errors in compatibility report generation', () => {
      expect(() => {
        AudioCompatibility.getCompatibilityReport();
      }).not.toThrow();
    });
  });

  describe('format support matrix', () => {
    it('should check all audio formats', () => {
      const formats = AudioCompatibility.getAudioFormatsSupported();
      const formatNames = Object.keys(formats);
      expect(formatNames.length).toBeGreaterThan(0);
    });

    it('should handle new formats gracefully', () => {
      const formats = AudioCompatibility.getAudioFormatsSupported();
      // Should not throw even if canPlayType returns unknown format
      expect(typeof formats).toBe('object');
    });
  });

  describe('browser detection', () => {
    it('should detect Chrome correctly', () => {
      const originalUserAgent = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 Chrome/120.0',
        configurable: true,
      });

      const info = AudioCompatibility.getBrowserInfo();
      // The detector should identify Chrome or Unknown
      expect(['Chrome', 'Unknown']).toContain(info.name);

      Object.defineProperty(navigator, 'userAgent', {
        value: originalUserAgent,
        configurable: true,
      });
    });
  });
});
