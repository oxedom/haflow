import type { AudioAssetMetadata, CacheStats } from '@haflow/shared';

export class AudioCacheService {
  private db: IDBDatabase | null = null;
  private readonly STORE_NAME = 'audioNotifications';
  private readonly METADATA_STORE = 'audioMetadata';
  private readonly DB_NAME = 'audio_cache_db';
  private readonly DB_VERSION = 1;
  private stats = {
    hits: 0,
    misses: 0,
    lastCleanup: Date.now(),
  };

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB is not supported in this browser'));
        return;
      }

      const request = window.indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores if they don't exist
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'soundId' });
        }

        if (!db.objectStoreNames.contains(this.METADATA_STORE)) {
          db.createObjectStore(this.METADATA_STORE, { keyPath: 'id' });
        }
      };
    });
  }

  async saveAudio(
    soundId: string,
    audioData: ArrayBuffer,
    metadata: AudioAssetMetadata
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(
        [this.STORE_NAME, this.METADATA_STORE],
        'readwrite'
      );

      // Save audio data
      const audioStore = transaction.objectStore(this.STORE_NAME);
      const audioRequest = audioStore.put({
        soundId,
        data: audioData,
        savedAt: Date.now(),
      });

      // Save metadata
      const metadataStore = transaction.objectStore(this.METADATA_STORE);
      const metadataRequest = metadataStore.put(metadata);

      transaction.oncomplete = () => {
        resolve();
      };

      transaction.onerror = () => {
        reject(new Error(`Failed to save audio: ${transaction.error?.message}`));
      };

      audioRequest.onerror = () => {
        reject(new Error(`Failed to save audio data: ${audioRequest.error?.message}`));
      };

      metadataRequest.onerror = () => {
        reject(new Error(`Failed to save metadata: ${metadataRequest.error?.message}`));
      };
    });
  }

  async getAudio(soundId: string): Promise<ArrayBuffer | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(this.STORE_NAME, 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(soundId);

      request.onsuccess = () => {
        if (request.result) {
          this.stats.hits++;
          resolve(request.result.data as ArrayBuffer);
        } else {
          this.stats.misses++;
          resolve(null);
        }
      };

      request.onerror = () => {
        reject(new Error(`Failed to retrieve audio: ${request.error?.message}`));
      };
    });
  }

  async removeAudio(soundId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(
        [this.STORE_NAME, this.METADATA_STORE],
        'readwrite'
      );

      const audioStore = transaction.objectStore(this.STORE_NAME);
      const metadataStore = transaction.objectStore(this.METADATA_STORE);

      audioStore.delete(soundId);
      metadataStore.delete(soundId);

      transaction.oncomplete = () => {
        resolve();
      };

      transaction.onerror = () => {
        reject(new Error(`Failed to remove audio: ${transaction.error?.message}`));
      };
    });
  }

  async clearCache(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(
        [this.STORE_NAME, this.METADATA_STORE],
        'readwrite'
      );

      transaction.objectStore(this.STORE_NAME).clear();
      transaction.objectStore(this.METADATA_STORE).clear();

      transaction.oncomplete = () => {
        this.stats.lastCleanup = Date.now();
        resolve();
      };

      transaction.onerror = () => {
        reject(new Error(`Failed to clear cache: ${transaction.error?.message}`));
      };
    });
  }

  async getMetadata(soundId: string): Promise<AudioAssetMetadata | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(this.METADATA_STORE, 'readonly');
      const store = transaction.objectStore(this.METADATA_STORE);
      const request = store.get(soundId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(new Error(`Failed to retrieve metadata: ${request.error?.message}`));
      };
    });
  }

  async getAllMetadata(): Promise<AudioAssetMetadata[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(this.METADATA_STORE, 'readonly');
      const store = transaction.objectStore(this.METADATA_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result as AudioAssetMetadata[]);
      };

      request.onerror = () => {
        reject(new Error(`Failed to retrieve all metadata: ${request.error?.message}`));
      };
    });
  }

  async verifyIntegrity(soundId: string, expectedHash: string): Promise<boolean> {
    try {
      const audioData = await this.getAudio(soundId);
      if (!audioData) {
        return false;
      }

      const hash = await this.hashArrayBuffer(audioData);
      return hash === expectedHash;
    } catch (error) {
      return false;
    }
  }

  async getCacheStats(): Promise<CacheStats> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(this.STORE_NAME, 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);

      // Get item count
      const countRequest = store.count();

      countRequest.onsuccess = async () => {
        try {
          const itemCount = countRequest.result;

          // Calculate total size
          let totalSize = 0;
          const request = store.getAll();

          request.onsuccess = () => {
            const items = request.result as any[];
            items.forEach((item) => {
              if (item.data instanceof ArrayBuffer) {
                totalSize += item.data.byteLength;
              }
            });

            const hitRate = this.stats.hits + this.stats.misses > 0
              ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
              : 0;

            resolve({
              totalSize,
              itemCount,
              hitRate,
              lastCleanup: this.stats.lastCleanup,
            });
          };

          request.onerror = () => {
            reject(new Error(`Failed to get cache stats: ${request.error?.message}`));
          };
        } catch (error) {
          reject(error);
        }
      };

      countRequest.onerror = () => {
        reject(new Error(`Failed to count items: ${countRequest.error?.message}`));
      };
    });
  }

  private async hashArrayBuffer(buffer: ArrayBuffer): Promise<string> {
    try {
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      throw new Error(`Failed to hash audio data: ${error}`);
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Singleton instance
let instance: AudioCacheService | null = null;

export function getAudioCacheService(): AudioCacheService {
  if (!instance) {
    instance = new AudioCacheService();
  }
  return instance;
}

export async function initializeAudioCacheService(): Promise<AudioCacheService> {
  const service = getAudioCacheService();
  await service.initialize();
  return service;
}
