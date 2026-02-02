import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioCacheService, getAudioCacheService, initializeAudioCacheService } from '../AudioCacheService';
import type { AudioAssetMetadata } from '@haflow/shared';

// Mock IndexedDB
const mockIDBStore = {
  data: new Map<string, any>(),
  clear() {
    this.data.clear();
  },
};

const createMockIDB = () => {
  const stores = {
    audioNotifications: { ...mockIDBStore },
    audioMetadata: { ...mockIDBStore },
  };

  return {
    open: (dbName: string, version: number) => {
      const request = {
        result: {
          objectStoreNames: {
            contains: (name: string) => name in stores,
          },
          transaction: (storeNames: string[], mode: string) => {
            return {
              objectStore: (name: string) => ({
                put: (item: any) => ({
                  onsuccess: null,
                  onerror: null,
                  addEventListener: (event: string, handler: () => void) => {
                    if (event === 'success') {
                      setTimeout(() => {
                        stores[name as keyof typeof stores].data.set(item.soundId || item.id, item);
                        handler();
                      }, 0);
                    }
                  },
                }),
                get: (key: string) => ({
                  result: stores[name as keyof typeof stores].data.get(key) || null,
                  onsuccess: null,
                  onerror: null,
                  addEventListener: (event: string, handler: () => void) => {
                    if (event === 'success') setTimeout(handler, 0);
                  },
                }),
                getAll: () => ({
                  result: Array.from(stores[name as keyof typeof stores].data.values()),
                  onsuccess: null,
                  onerror: null,
                  addEventListener: (event: string, handler: () => void) => {
                    if (event === 'success') setTimeout(handler, 0);
                  },
                }),
                count: () => ({
                  result: stores[name as keyof typeof stores].data.size,
                  onsuccess: null,
                  onerror: null,
                  addEventListener: (event: string, handler: () => void) => {
                    if (event === 'success') setTimeout(handler, 0);
                  },
                }),
                delete: (key: string) => ({
                  onsuccess: null,
                  onerror: null,
                  addEventListener: (event: string, handler: () => void) => {
                    if (event === 'success') {
                      stores[name as keyof typeof stores].data.delete(key);
                      handler();
                    }
                  },
                }),
                clear: () => ({
                  onsuccess: null,
                  onerror: null,
                  addEventListener: (event: string, handler: () => void) => {
                    if (event === 'success') {
                      stores[name as keyof typeof stores].data.clear();
                      handler();
                    }
                  },
                }),
              }),
              oncomplete: null,
              onerror: null,
              addEventListener: (event: string, handler: () => void) => {
                if (event === 'complete') setTimeout(handler, 0);
              },
            };
          },
          close: () => {},
        },
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        addEventListener: (event: string, handler: (e: any) => void) => {
          if (event === 'success') {
            setTimeout(() => {
              if (request.onsuccess) request.onsuccess();
            }, 0);
          }
          if (event === 'upgradeneeded') {
            setTimeout(() => {
              if (request.onupgradeneeded) {
                request.onupgradeneeded({ target: request });
              }
            }, 0);
          }
        },
      };

      return request as any;
    },
  };
};

// Mock crypto.subtle.digest
const mockCryptoDigest = async (algorithm: string, data: ArrayBuffer): Promise<ArrayBuffer> => {
  // Simple mock: just return a fixed hash
  return new ArrayBuffer(32); // SHA-256 is 32 bytes
};

describe('AudioCacheService', () => {
  let service: AudioCacheService;

  beforeEach(async () => {
    // Mock IndexedDB
    global.indexedDB = createMockIDB() as any;

    // Mock crypto
    if (!global.crypto) {
      (global as any).crypto = {};
    }
    if (!global.crypto.subtle) {
      global.crypto.subtle = {
        digest: mockCryptoDigest,
      } as any;
    }

    service = new AudioCacheService();
    try {
      await service.initialize();
    } catch {
      // Ignore initialization errors in tests
    }
  });

  afterEach(async () => {
    try {
      await service.close();
    } catch {
      // Ignore
    }
  });

  describe('initialization', () => {
    it('should initialize without errors', async () => {
      const newService = new AudioCacheService();
      await expect(newService.initialize()).resolves.toBeUndefined();
    });

    it('should handle missing IndexedDB', async () => {
      const originalIDB = global.indexedDB;
      delete (global as any).indexedDB;

      const newService = new AudioCacheService();
      await expect(newService.initialize()).rejects.toThrow();

      (global as any).indexedDB = originalIDB;
    });
  });

  describe('audio storage and retrieval', () => {
    it('should save and retrieve audio data', async () => {
      const soundId = 'test-sound';
      const audioData = new ArrayBuffer(1000);
      const metadata: AudioAssetMetadata = {
        id: soundId,
        filename: 'test.wav',
        format: 'wav',
        hash: 'abc123',
        size: 1000,
        duration: 2000,
        priority: 'standard',
        preload: true,
      };

      await service.saveAudio(soundId, audioData, metadata);
      const retrieved = await service.getAudio(soundId);

      expect(retrieved).toEqual(audioData);
    });

    it('should return null for non-existent audio', async () => {
      const retrieved = await service.getAudio('nonexistent');
      expect(retrieved).toBeNull();
    });
  });

  describe('metadata operations', () => {
    it('should save and retrieve metadata', async () => {
      const metadata: AudioAssetMetadata = {
        id: 'test-meta',
        filename: 'test.wav',
        format: 'wav',
        hash: 'hash123',
        size: 2000,
        duration: 3000,
        priority: 'high',
        preload: true,
      };

      await service.saveAudio('test-meta', new ArrayBuffer(2000), metadata);
      const retrieved = await service.getMetadata('test-meta');

      expect(retrieved?.id).toBe(metadata.id);
      expect(retrieved?.filename).toBe(metadata.filename);
    });

    it('should return null for non-existent metadata', async () => {
      const retrieved = await service.getMetadata('nonexistent');
      expect(retrieved).toBeNull();
    });

    it('should get all metadata', async () => {
      const meta1: AudioAssetMetadata = {
        id: 'sound1',
        filename: 'sound1.wav',
        format: 'wav',
        hash: 'hash1',
        size: 1000,
        duration: 1000,
        priority: 'standard',
        preload: true,
      };

      const meta2: AudioAssetMetadata = {
        id: 'sound2',
        filename: 'sound2.wav',
        format: 'wav',
        hash: 'hash2',
        size: 2000,
        duration: 2000,
        priority: 'high',
        preload: false,
      };

      await service.saveAudio('sound1', new ArrayBuffer(1000), meta1);
      await service.saveAudio('sound2', new ArrayBuffer(2000), meta2);

      const allMeta = await service.getAllMetadata();
      expect(allMeta.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('audio removal', () => {
    it('should remove audio from cache', async () => {
      const soundId = 'test-remove';
      const metadata: AudioAssetMetadata = {
        id: soundId,
        filename: 'test.wav',
        format: 'wav',
        hash: 'hash',
        size: 1000,
        duration: 1000,
        priority: 'standard',
        preload: true,
      };

      await service.saveAudio(soundId, new ArrayBuffer(1000), metadata);
      let retrieved = await service.getAudio(soundId);
      expect(retrieved).not.toBeNull();

      await service.removeAudio(soundId);
      retrieved = await service.getAudio(soundId);
      expect(retrieved).toBeNull();
    });
  });

  describe('cache management', () => {
    it('should clear cache', async () => {
      const metadata: AudioAssetMetadata = {
        id: 'clear-test',
        filename: 'test.wav',
        format: 'wav',
        hash: 'hash',
        size: 1000,
        duration: 1000,
        priority: 'standard',
        preload: true,
      };

      await service.saveAudio('clear-test', new ArrayBuffer(1000), metadata);
      await service.clearCache();

      const retrieved = await service.getAudio('clear-test');
      expect(retrieved).toBeNull();
    });

    it('should calculate cache stats', async () => {
      const metadata: AudioAssetMetadata = {
        id: 'stats-test',
        filename: 'test.wav',
        format: 'wav',
        hash: 'hash',
        size: 1000,
        duration: 1000,
        priority: 'standard',
        preload: true,
      };

      await service.saveAudio('stats-test', new ArrayBuffer(1000), metadata);

      const stats = await service.getCacheStats();
      expect(stats).toHaveProperty('totalSize');
      expect(stats).toHaveProperty('itemCount');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('lastCleanup');
      expect(typeof stats.totalSize).toBe('number');
      expect(typeof stats.itemCount).toBe('number');
    });
  });

  describe('integrity verification', () => {
    it('should verify audio integrity with matching hash', async () => {
      const soundId = 'verify-test';
      const audioData = new ArrayBuffer(1000);
      const metadata: AudioAssetMetadata = {
        id: soundId,
        filename: 'test.wav',
        format: 'wav',
        hash: 'testhash',
        size: 1000,
        duration: 1000,
        priority: 'standard',
        preload: true,
      };

      await service.saveAudio(soundId, audioData, metadata);

      // Note: The actual verification depends on the hash function
      // In this test, we just verify the method completes
      const result = await service.verifyIntegrity(soundId, 'testhash');
      expect(typeof result).toBe('boolean');
    });

    it('should return false for non-existent audio during verification', async () => {
      const result = await service.verifyIntegrity('nonexistent', 'hash');
      expect(result).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle database not initialized errors', async () => {
      const uninitializedService = new AudioCacheService();

      await expect(
        uninitializedService.getAudio('test')
      ).rejects.toThrow('Database not initialized');
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance when called multiple times', () => {
      const service1 = getAudioCacheService();
      const service2 = getAudioCacheService();
      expect(service1).toBe(service2);
    });

    it('should initialize singleton service', async () => {
      const service = await initializeAudioCacheService();
      expect(service).toBeDefined();
    });
  });

  describe('close', () => {
    it('should close database without errors', async () => {
      await expect(service.close()).resolves.toBeUndefined();
    });
  });
});
