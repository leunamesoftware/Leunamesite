import type { Storage } from './types.js';

/** The slice of the Cloudflare R2 binding that Hazluno uses. */
export interface R2Bucket {
  put(key: string, value: Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ body: ReadableStream; size: number; httpMetadata?: { contentType?: string } } | null>;
  delete(key: string): Promise<void>;
}

export function createR2Storage(bucket: R2Bucket): Storage {
  return {
    async put(key, data, contentType) { await bucket.put(key, data, { httpMetadata: { contentType } }); },
    async get(key) {
      const o = await bucket.get(key);
      return o ? { body: o.body, size: o.size, contentType: o.httpMetadata?.contentType ?? 'application/octet-stream' } : null;
    },
    async delete(key) { await bucket.delete(key); },
  };
}
