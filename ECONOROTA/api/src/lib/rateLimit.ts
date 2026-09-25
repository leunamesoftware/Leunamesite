/**
 * Limite de requisições por janela (Fase 17), guardado no D1 (sem serviço extra).
 * Protege cadastro, recuperação de senha, pedidos, pagamentos e códigos contra abuso e robôs.
 */
import { createMiddleware } from 'hono/factory';

import type { AppEnv } from './types';

export const clientIp = (h: (name: string) => string | undefined) => h('cf-connecting-ip') ?? h('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';

/** Só conta requisições POST (leituras não são limitadas). */
export const rateLimit = (name: string, limit: number, windowSec: number, by: 'ip' | 'user' = 'ip') =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (c.req.method !== 'POST') return next();
    // Em desenvolvimento os testes automáticos repetem muitas chamadas do mesmo IP.
    const max = c.env.DEV_MODE === 'true' ? limit * 20 : limit;
    const who = by === 'user' ? c.get('user')?.id : clientIp((n) => c.req.header(n));
    const now = Math.floor(Date.now() / 1000);
    const row = await c.env.DB.prepare(
      `INSERT INTO rate_limits (key, count, reset_at) VALUES (?1, 1, ?2)
       ON CONFLICT(key) DO UPDATE SET count = CASE WHEN reset_at <= ?3 THEN 1 ELSE count + 1 END,
                                      reset_at = CASE WHEN reset_at <= ?3 THEN ?2 ELSE reset_at END
       RETURNING count, reset_at`,
    )
      .bind(`${name}:${who ?? 'anon'}`, now + windowSec, now)
      .first<{ count: number; reset_at: number }>();
    if (Math.random() < 0.01) {
      c.executionCtx.waitUntil(c.env.DB.prepare('DELETE FROM rate_limits WHERE reset_at < ?').bind(now - 3600).run());
    }
    if (row && row.count > max) {
      return c.json(
        { error: { code: 'rate_limited', message: 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.' } },
        429,
        { 'Retry-After': String(Math.max(row.reset_at - now, 1)) },
      );
    }
    await next();
  });
