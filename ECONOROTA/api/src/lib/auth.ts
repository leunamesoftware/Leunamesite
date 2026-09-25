import { createMiddleware } from 'hono/factory';

import { verifyToken } from './crypto';
import { forbidden, unauthorized } from './errors';
import type { AppEnv, Role } from './types';

/** Exige token válido e, opcionalmente, um dos perfis informados. */
export const requireAuth = (...roles: Role[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const header = c.req.header('Authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const payload = token && (await verifyToken(token, c.env.JWT_SECRET));
    if (!payload) throw unauthorized('Sessão inválida ou expirada.');

    const row = await c.env.DB.prepare('SELECT id, role, status, token_version FROM users WHERE id = ?')
      .bind(payload.sub)
      .first<{ id: string; role: Role; status: string; token_version: number }>();
    if (!row || row.token_version !== payload.tv) throw unauthorized('Sessão inválida ou expirada.');
    if (row.status === 'bloqueado') throw forbidden('Conta bloqueada.');
    if (roles.length && !roles.includes(row.role)) throw forbidden();

    c.set('user', { id: row.id, role: row.role });
    await next();
  });

export async function audit(db: D1Database, entry: { userId?: string; action: string; entity?: string; entityId?: string; ip?: string; data?: unknown }) {
  await db
    .prepare('INSERT INTO audit_logs (id, user_id, action, entity, entity_id, data, ip) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(
      crypto.randomUUID(),
      entry.userId ?? null,
      entry.action,
      entry.entity ?? null,
      entry.entityId ?? null,
      entry.data === undefined ? null : JSON.stringify(entry.data),
      entry.ip ?? null,
    )
    .run();
}
