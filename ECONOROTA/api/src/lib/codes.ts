import type { Channel, Env } from './types';

const TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
export const RESEND_SECONDS = 60;
const MAX_PER_HOUR = 5;

export type Purpose = 'verify' | 'reset';

/** Código numérico de 6 dígitos com distribuição uniforme. */
function randomCode() {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0xffffffff / 1_000_000) * 1_000_000;
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return String(buf[0] % 1_000_000).padStart(6, '0');
}

async function hashCode(code: string, userId: string, secret: string) {
  const data = new TextEncoder().encode(`${secret}:${userId}:${code}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const iso = (d: Date) => d.toISOString();

export type IssueResult = { ok: true; code: string } | { ok: false; retryIn: number };

/** Gera um novo código, invalidando os anteriores do mesmo propósito. Aplica limite de reenvio. */
export async function issueCode(env: Env, userId: string, purpose: Purpose, channel: Channel): Promise<IssueResult> {
  const recent = await env.DB.prepare(
    `SELECT created_at FROM verification_codes
      WHERE user_id = ? AND purpose = ? AND created_at > ?
      ORDER BY created_at DESC`,
  )
    .bind(userId, purpose, iso(new Date(Date.now() - 3600_000)))
    .all<{ created_at: string }>();

  const last = recent.results[0];
  if (last) {
    const elapsed = (Date.now() - Date.parse(last.created_at)) / 1000;
    if (elapsed < RESEND_SECONDS) return { ok: false, retryIn: Math.ceil(RESEND_SECONDS - elapsed) };
  }
  if (recent.results.length >= MAX_PER_HOUR) return { ok: false, retryIn: 3600 };

  const code = randomCode();
  const now = new Date();
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE verification_codes SET consumed_at = ? WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL",
    ).bind(iso(now), userId, purpose),
    env.DB.prepare(
      'INSERT INTO verification_codes (id, user_id, purpose, channel, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).bind(
      crypto.randomUUID(),
      userId,
      purpose,
      channel,
      await hashCode(code, userId, env.JWT_SECRET),
      iso(new Date(now.getTime() + TTL_MINUTES * 60_000)),
      iso(now),
    ),
  ]);
  return { ok: true, code };
}

export type CheckResult = { ok: true; channel: Channel } | { ok: false; reason: 'invalid' | 'expired' | 'locked' };

/** Confere o código mais recente; consome em caso de sucesso e conta tentativas em caso de erro. */
export async function checkCode(env: Env, userId: string, purpose: Purpose, code: string): Promise<CheckResult> {
  const row = await env.DB.prepare(
    `SELECT id, channel, code_hash, attempts, expires_at FROM verification_codes
      WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL
      ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(userId, purpose)
    .first<{ id: string; channel: Channel; code_hash: string; attempts: number; expires_at: string }>();

  if (!row) return { ok: false, reason: 'invalid' };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'locked' };
  if (Date.parse(row.expires_at) < Date.now()) return { ok: false, reason: 'expired' };

  const valid = /^\d{6}$/.test(code) && (await hashCode(code, userId, env.JWT_SECRET)) === row.code_hash;
  if (!valid) {
    await env.DB.prepare('UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?').bind(row.id).run();
    return { ok: false, reason: row.attempts + 1 >= MAX_ATTEMPTS ? 'locked' : 'invalid' };
  }
  await env.DB.prepare('UPDATE verification_codes SET consumed_at = ? WHERE id = ?').bind(iso(new Date()), row.id).run();
  return { ok: true, channel: row.channel };
}
