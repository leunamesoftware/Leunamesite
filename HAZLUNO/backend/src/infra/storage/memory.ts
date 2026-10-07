import type { Storage } from './types.js';

/** In-memory storage for tests. */
export function createMemoryStorage(): Storage & { keys(): string[] } {
  const files = new Map<string, { data: Uint8Array; contentType: string }>();
  return {
    async put(key, data, contentType) { files.set(key, { data, contentType }); },
    async get(key) {
      const f = files.get(key);
      return f ? { body: f.data, contentType: f.contentType, size: f.data.byteLength } : null;
    },
    async delete(key) { files.delete(key); },
    keys: () => [...files.keys()],
  };
}
