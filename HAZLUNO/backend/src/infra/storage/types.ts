/** File storage port (avatars, course covers; later materials and certificates). */
export interface StoredFile {
  body: ReadableStream | Uint8Array;
  contentType: string;
  size: number;
}

export interface Storage {
  put(key: string, data: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<StoredFile | null>;
  delete(key: string): Promise<void>;
}
