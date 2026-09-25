/** Fotos enviadas pelo app (documentos, evidências): só JPG/PNG/WEBP de verdade, até 5 MB. */
import type { Context } from 'hono';

import { badRequest } from './errors';
import type { AppEnv } from './types';

export const MAX_FILE = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export async function readImage(c: Context<AppEnv>) {
  const type = (c.req.header('Content-Type') ?? '').split(';')[0].trim();
  if (!TYPES[type]) throw badRequest('Envie uma foto JPG, PNG ou WEBP.', 'validation');
  if (Number(c.req.header('Content-Length') ?? 0) > MAX_FILE) throw badRequest('Foto muito grande (máximo 5 MB).', 'validation');
  const buf = await c.req.arrayBuffer();
  if (!buf.byteLength || buf.byteLength > MAX_FILE) throw badRequest('Foto muito grande (máximo 5 MB).', 'validation');
  const h = new Uint8Array(buf.slice(0, 12));
  const isImg =
    (h[0] === 0xff && h[1] === 0xd8) || // jpg
    (h[0] === 0x89 && h[1] === 0x50) || // png
    (h[8] === 0x57 && h[9] === 0x45 && h[10] === 0x42 && h[11] === 0x50); // webp
  if (!isImg) throw badRequest('O arquivo não é uma imagem válida.', 'validation');
  return { buf, type, ext: TYPES[type] };
}

/** Devolve um arquivo privado do R2 (sem cache). */
export async function streamFile(bucket: R2Bucket, key: string) {
  const obj = await bucket.get(key);
  if (!obj) return null;
  return new Response(obj.body, {
    headers: { 'Content-Type': obj.httpMetadata?.contentType ?? 'image/jpeg', 'Cache-Control': 'private, no-store' },
  });
}
