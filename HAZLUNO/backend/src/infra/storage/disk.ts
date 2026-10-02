import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { Storage } from './types.js';

/** Local folder storage for development. Keys never leave the base folder. */
export function createDiskStorage(baseDir: string): Storage {
  const base = resolve(baseDir);
  const pathOf = (key: string) => {
    const p = resolve(join(base, key));
    if (!p.startsWith(base + '/')) throw new Error('invalid storage key');
    return p;
  };
  return {
    async put(key, data, contentType) {
      const p = pathOf(key);
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, data);
      await writeFile(`${p}.type`, contentType);
    },
    async get(key) {
      try {
        const p = pathOf(key);
        const data = new Uint8Array(await readFile(p));
        return { body: data, contentType: await readFile(`${p}.type`, 'utf8'), size: data.byteLength };
      } catch {
        return null;
      }
    },
    async delete(key) {
      const p = pathOf(key);
      await rm(p, { force: true });
      await rm(`${p}.type`, { force: true });
    },
  };
}
