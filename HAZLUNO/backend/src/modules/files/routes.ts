import { Hono } from 'hono';
import type { AppEnv, Deps } from '../../common/env.js';
import { errors } from '../../common/errors.js';

/** Public images (avatars, covers). Only keys under "public/" are ever served here. */
export function fileRoutes(deps: Deps) {
  const r = new Hono<AppEnv>();
  r.get('/public/*', async (c) => {
    const key = c.req.path.replace(/^\/api\/files\//, '');
    if (!/^public\/(avatars|covers)\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(key)) throw errors.notFound('File');
    const f = await deps.storage.get(key);
    if (!f) throw errors.notFound('File');
    return new Response(f.body as BodyInit, {
      headers: { 'Content-Type': f.contentType, 'Content-Length': String(f.size), 'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff' },
    });
  });
  return r;
}
