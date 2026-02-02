import type { BrowserInfo, CompatibilityReport } from '@haflow/shared';

export class AudioCompatibility {
  static isAudioElementSupported(): boolean {
    // Check for HTMLAudioElement support
    try {
      return !!(document.createElement('audio').canPlayType);
    } catch {
      return false;
    }
  }

  static isWebAudioAPISupported(): boolean {
    // Check for Web Audio API
    try {
      const audioContext = window.AudioContext || (window as any).webkitAudioContext;
      return !!audioContext;
    } catch {
      return false;
    }
  }

  static isBrowserSupported(): boolean {
    // Requires both HTML5 Audio and Web Audio API
    return this.isAudioElementSupported() && this.isWebAudioAPISupported();
  }

  static getAudioFormatsSupported(): Record<string, boolean> {
    try {
      const audio = document.createElement('audio');
      return {
        mp3: audio.canPlayType('audio/mpeg') !== '',
        wav: audio.canPlayType('audio/wav') !== '',
        ogg: audio.canPlayType('audio/ogg') !== '',
        aac: audio.canPlayType('audio/aac') !== '',
        flac: audio.canPlayType('audio/flac') !== '',
      };
    } catch {
      return {
        mp3: false,
        wav: false,
        ogg: false,
        aac: false,
        flac: false,
      };
    }
  }

  static supportsPermissionsAPI(): boolean {
    try {
      return !!navigator.permissions;
    } catch {
      return false;
    }
  }

  static supportsServiceWorker(): boolean {
    try {
      return !!navigator.serviceWorker;
    } catch {
      return false;
    }
  }

  static supportsIndexedDB(): boolean {
    try {
      return !!window.indexedDB;
    } catch {
      return false;
    }
  }

  static getBrowserInfo(): BrowserInfo {
    const userAgent = navigator.userAgent;
    let browserName = 'Unknown';
    let version = 'Unknown';
    let platform = navigator.platform;

    // Detect browser
    if (userAgent.includes('Firefox')) {
      browserName = 'Firefox';
      const versionMatch = userAgent.match(/Firefox\/(\d+)/);
      if (versionMatch) version = versionMatch[1];
    } else if (userAgent.includes('Chrome')) {
      browserName = 'Chrome';
      const versionMatch = userAgent.match(/Chrome\/(\d+)/);
      if (versionMatch) version = versionMatch[1];
    } else if (userAgent.includes('Safari')) {
      browserName = 'Safari';
      const versionMatch = userAgent.match(/Version\/(\d+)/);
      if (versionMatch) version = versionMatch[1];
    } else if (userAgent.includes('Edge')) {
      browserName = 'Edge';
      const versionMatch = userAgent.match(/Edg\/(\d+)/);
      if (versionMatch) version = versionMatch[1];
    }

    return {
      name: browserName,
      version,
      platform,
    };
  }

  static getCompatibilityReport(): CompatibilityReport {
    const audioElement = this.isAudioElementSupported();
    const webAudioAPI = this.isWebAudioAPISupported();
    const serviceWorker = this.supportsServiceWorker();
    const permissionsAPI = this.supportsPermissionsAPI();
    const indexedDB = this.supportsIndexedDB();

    const formatsSupported = this.getAudioFormatsSupported();
    const supportedFormats = Object.entries(formatsSupported)
      .filter(([_, supported]) => supported)
      .map(([format]) => format);

    const warnings: string[] = [];

    if (!audioElement) {
      warnings.push('HTML5 Audio element not supported');
    }

    if (!webAudioAPI) {
      warnings.push('Web Audio API not supported');
    }

    if (!serviceWorker) {
      warnings.push('Service Worker not supported (offline caching unavailable)');
    }

    if (!indexedDB) {
      warnings.push('IndexedDB not supported (in-memory caching only)');
    }

    if (supportedFormats.length === 0) {
      warnings.push('No audio formats supported');
    }

    const isFullySupported =
      audioElement && webAudioAPI && serviceWorker && indexedDB && supportedFormats.length > 0;

    return {
      isFullySupported,
      audioElement,
      webAudioAPI,
      serviceWorker,
      permissionsAPI,
      supportedFormats,
      warnings,
    };
  }

  // Check if autoplay is likely to work
  static async canAutoplay(): Promise<boolean> {
    try {
      const audio = new Audio();
      audio.src =
        'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAA';
      const playPromise = audio.play();

      if (playPromise === undefined) {
        return true; // Old browser, assume autoplay works
      }

      try {
        await playPromise;
        return true;
      } catch (error) {
        return false;
      }
    } catch {
      return false;
    }
  }

  static logCapabilities(): void {
    const browser = this.getBrowserInfo();
    const report = this.getCompatibilityReport();

    console.log('=== Audio Capability Report ===');
    console.log(`Browser: ${browser.name} ${browser.version}`);
    console.log(`Platform: ${browser.platform}`);
    console.log(`Audio Element: ${report.audioElement ? '✓' : '✗'}`);
    console.log(`Web Audio API: ${report.webAudioAPI ? '✓' : '✗'}`);
    console.log(`Service Worker: ${report.serviceWorker ? '✓' : '✗'}`);
    console.log(`IndexedDB: ${report.permissionsAPI ? '✓' : '✗'}`);
    console.log(`Supported Formats: ${report.supportedFormats.join(', ')}`);

    if (report.warnings.length > 0) {
      console.warn('Warnings:');
      report.warnings.forEach((warning) => console.warn(`  - ${warning}`));
    }

    console.log(`Overall Support: ${report.isFullySupported ? '✓ Fully Supported' : '✗ Limited'}`);
  }
}

// Export type predicates for use in conditions
export const isAudioSupported = AudioCompatibility.isBrowserSupported;
export const isWebAudioSupported = AudioCompatibility.isWebAudioAPISupported;
export const isServiceWorkerSupported = AudioCompatibility.supportsServiceWorker;
export const isIndexedDBSupported = AudioCompatibility.supportsIndexedDB;
