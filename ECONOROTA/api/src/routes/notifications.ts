import { Hono } from 'hono';

import { requireAuth } from '../lib/auth';
import { badRequest } from '../lib/errors';
import type { AppEnv } from '../lib/types';
import { oneOf, readJson, str } from '../lib/validate';

/** Central de notificações do usuário logado (Fase 16). */
const notifications = new Hono<AppEnv>();

notifications.get('/notificacoes', requireAuth(), async (c) => {
  const user = c.get('user').id;
  const [list, unread] = await c.env.DB.batch([
    c.env.DB.prepare('SELECT id, kind, title, body, link, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').bind(user),
    c.env.DB.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL').bind(user),
  ]);
  return c.json({ items: list.results, unread: (unread.results[0] as { n: number }).n });
});

/** Só a contagem (o app consulta periodicamente). */
notifications.get('/notificacoes/nao-lidas', requireAuth(), async (c) => {
  const r = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL').bind(c.get('user').id).first<{ n: number }>();
  return c.json({ unread: r?.n ?? 0 });
});

/** Marca como lidas: { ids: [...] } ou todas. */
notifications.post('/notificacoes/lidas', requireAuth(), async (c) => {
  const b = await readJson(c.req.raw);
  const user = c.get('user').id;
  const ids = Array.isArray(b.ids) ? (b.ids as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 100) : null;
  const now = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
  if (ids && ids.length) {
    await c.env.DB.prepare(`UPDATE notifications SET read_at = ${now} WHERE user_id = ? AND read_at IS NULL AND id IN (${ids.map(() => '?').join(',')})`)
      .bind(user, ...ids)
      .run();
  } else {
    await c.env.DB.prepare(`UPDATE notifications SET read_at = ${now} WHERE user_id = ? AND read_at IS NULL`).bind(user).run();
  }
  return c.json({ ok: true });
});

/** Registra o dispositivo para push (token do Firebase). */
notifications.post('/dispositivos', requireAuth(), async (c) => {
  const b = await readJson(c.req.raw);
  const token = str(b, 'token', { min: 20, max: 400 })!;
  const platform = oneOf(b, 'platform', ['android', 'ios', 'web'] as const);
  await c.env.DB.prepare(
    `INSERT INTO push_tokens (token, user_id, platform) VALUES (?, ?, ?)
     ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, platform = excluded.platform, last_seen_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
  )
    .bind(token, c.get('user').id, platform)
    .run();
  return c.json({ ok: true }, 201);
});

notifications.delete('/dispositivos/:token', requireAuth(), async (c) => {
  const token = c.req.param('token');
  if (token.length > 400) throw badRequest('Token inválido.', 'validation');
  await c.env.DB.prepare('DELETE FROM push_tokens WHERE token = ? AND user_id = ?').bind(token, c.get('user').id).run();
  return c.json({ ok: true });
});

export default notifications;
