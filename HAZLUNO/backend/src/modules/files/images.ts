import type { Deps } from '../../common/env.js';
import { AppError } from '../../common/errors.js';
import { newId } from '../../common/security.js';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Real type from the first bytes (never trust the file name or the declared type). */
function sniff(b: Uint8Array): { type: string; ext: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { type: 'image/jpeg', ext: 'jpg' };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { type: 'image/png', ext: 'png' };
  if (String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return { type: 'image/webp', ext: 'webp' };
  return null;
}

/** Reads the "file" field of a multipart upload, checks it is a real image and stores it under public/<folder>/. */
export async function storeImage(deps: Deps, request: Request, folder: 'avatars' | 'covers'): Promise<string> {
  let form: FormData;
  try { form = await request.formData(); } catch { throw new AppError('file_invalid', 400, 'Send the image as multipart/form-data in the "file" field.'); }
  const file = form.get('file');
  if (!file || typeof file === 'string') throw new AppError('file_invalid', 400, 'Send the image in the "file" field.');
  if (file.size > MAX_IMAGE_BYTES) throw new AppError('file_too_large', 400, 'Images can be at most 5 MB.');
  const data = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(data);
  if (!kind) throw new AppError('file_invalid', 400, 'Only JPG, PNG or WebP images.');
  const key = `public/${folder}/${newId()}.${kind.ext}`;
  await deps.storage.put(key, data, kind.type);
  return key;
}

export const publicUrl = (key: string | null) => (key ? `/api/files/${key}` : null);
