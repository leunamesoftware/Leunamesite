import { Hono, type Context } from 'hono';

import { audit, requireAuth } from '../lib/auth';
import { checkCode, issueCode, RESEND_SECONDS, type Purpose } from '../lib/codes';
import { hashPassword, newId, signToken, verifyPassword } from '../lib/crypto';
import { ApiError, badRequest, conflict, forbidden, notFound, unauthorized } from '../lib/errors';
import { verifyGoogleIdToken } from '../lib/google';
import { channelsAvailable, sendCode } from '../lib/notify';
import { maskEmail, maskPhone, normalizePhone } from '../lib/phone';
import { notifyAdmins } from '../lib/notifications';
import type { AppEnv, Channel, Env, Role } from '../lib/types';
import { email, oneOf, password, readJson, str } from '../lib/validate';

type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  status: string;
  password_hash: string;
  token_version: number;
  email_verified_at: string | null;
  phone_verified_at: string | null;
  google_sub: string | null;
};

const publicUser = (u: UserRow) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  role: u.role,
  status: u.status,
  verified: Boolean(u.email_verified_at || u.phone_verified_at),
});

// Hash fixo usado quando a conta não existe, para o tempo de resposta não revelar contas.
const DUMMY_HASH = 'pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const MAX_FAILED_LOGINS = 8; // por conta, em 15 minutos

const ip = (c: Context<AppEnv>) => c.req.header('CF-Connecting-IP');
const now = () => new Date().toISOString();

async function session(env: Env, user: UserRow) {
  const token = await signToken({ sub: user.id, role: user.role, tv: user.token_version }, env.JWT_SECRET, Number(env.TOKEN_TTL_HOURS));
  return { token, user: publicUser(user) };
}

const getUser = (env: Env, id: string) => env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();

/** Aceita e-mail ou telefone no mesmo campo. */
async function findByLogin(env: Env, login: string) {
  if (login.includes('@')) return env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(login.toLowerCase()).first<UserRow>();
  const phone = normalizePhone(login);
  return phone ? env.DB.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first<UserRow>() : null;
}

function loginField(body: Record<string, unknown>) {
  const login = str(body, body.login !== undefined ? 'login' : 'email', { max: 254 })!;
  if (!login.includes('@') && !normalizePhone(login)) throw badRequest('Informe um e-mail ou telefone válido.', 'validation');
  return login;
}

/** Envia um código e devolve dados seguros para a tela (destino mascarado, tempo de reenvio). */
async function deliverCode(c: Context<AppEnv>, user: UserRow, purpose: Purpose, channel: Channel) {
  const target = channel === 'email' ? user.email : user.phone;
  if (!target) throw badRequest('Nenhum telefone cadastrado para este canal.', 'no_phone');
  if (!channelsAvailable(c.env)[channel]) throw new ApiError(503, 'channel_unavailable', 'Canal de envio indisponível no momento.');

  const issued = await issueCode(c.env, user.id, purpose, channel);
  if (!issued.ok) {
    throw new ApiError(429, 'too_many_requests', `Aguarde ${issued.retryIn} segundos para pedir um novo código.`);
  }
  await sendCode(c.env, channel, target, issued.code, purpose);
  await audit(c.env.DB, { userId: user.id, action: `code.${purpose}.sent`, entity: 'user', entityId: user.id, ip: ip(c), data: { channel } });
  return {
    channel,
    target: channel === 'email' ? maskEmail(target) : maskPhone(target),
    resend_in: RESEND_SECONDS,
    ...(c.env.DEV_MODE === 'true' ? { dev_code: issued.code } : {}),
  };
}

const codeError = (reason: 'invalid' | 'expired' | 'locked') =>
  ({
    invalid: badRequest('Código incorreto. Confira e tente novamente.', 'invalid_code'),
    expired: badRequest('Código expirado. Peça um novo código.', 'expired_code'),
    locked: new ApiError(429, 'code_locked', 'Muitas tentativas. Peça um novo código.'),
  })[reason];

const auth = new Hono<AppEnv>();

/** Configuração pública consumida pelo app (canais e provedores ativos). */
auth.get('/config', (c) =>
  c.json({ channels: channelsAvailable(c.env), google: Boolean(c.env.GOOGLE_CLIENT_IDS), resend_in: RESEND_SECONDS }),
);

auth.post('/register', async (c) => {
  const body = await readJson(c.req.raw);
  const name = str(body, 'name', { min: 3, max: 120 })!;
  const mail = email(body);
  const pass = password(body);
  const rawPhone = str(body, 'phone', { optional: true, max: 20 });
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (rawPhone && !phone) throw badRequest('Telefone inválido. Use DDD + número.', 'validation');
  // Administradores não se cadastram pelo app (ver scripts/create-admin.mjs).
  const role = oneOf(body, 'role', ['cliente', 'mercado', 'entregador'] as const);
  if (body.accept_terms !== true) throw badRequest('É preciso aceitar os Termos de Uso e a Política de Privacidade.', 'terms_required');
  const marketName = role === 'mercado' ? (str(body, 'market_name', { min: 2, max: 120, optional: true }) ?? name) : undefined;

  const db = c.env.DB;
  if (await db.prepare('SELECT 1 FROM users WHERE email = ?').bind(mail).first()) throw conflict('E-mail já cadastrado.', 'email_taken');
  if (phone && (await db.prepare('SELECT 1 FROM users WHERE phone = ?').bind(phone).first())) {
    throw conflict('Telefone já cadastrado.', 'phone_taken');
  }

  const id = newId();
  // Mercado e entregador ficam pendentes até aprovação do administrador.
  const status = role === 'cliente' ? 'ativo' : 'pendente';
  const stmts = [
    db.prepare(
      'INSERT INTO users (id, name, email, phone, password_hash, role, status, accepted_terms_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(id, name, mail, phone, await hashPassword(pass), role, status, now()),
  ];
  if (role === 'cliente') stmts.push(db.prepare('INSERT INTO customers (id, user_id) VALUES (?, ?)').bind(newId(), id));
  if (role === 'entregador') stmts.push(db.prepare('INSERT INTO couriers (id, user_id) VALUES (?, ?)').bind(newId(), id));
  if (role === 'mercado') stmts.push(db.prepare('INSERT INTO markets (id, owner_user_id, name) VALUES (?, ?, ?)').bind(newId(), id, marketName));
  await db.batch(stmts);
  if (role === 'mercado') {
    await notifyAdmins(c.env, {
      kind: 'mercado_novo',
      title: 'Novo mercado cadastrado',
      body: `${marketName} quer vender no EconoRota. Confira os dados e aprove.`,
      link: '/admin/mercados',
    });
  }
  await audit(db, { userId: id, action: 'user.register', entity: 'user', entityId: id, ip: ip(c) });

  const user = (await getUser(c.env, id))!;
  return c.json(await session(c.env, user), 201);
});

auth.post('/login', async (c) => {
  const body = await readJson(c.req.raw);
  const login = loginField(body);
  const pass = password(body);
  const user = await findByLogin(c.env, login);

  if (user) {
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const failed = await c.env.DB.prepare(
      "SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'auth.login_failed' AND entity_id = ? AND created_at > ?",
    )
      .bind(user.id, since)
      .first<{ n: number }>();
    if ((failed?.n ?? 0) >= MAX_FAILED_LOGINS) {
      throw new ApiError(429, 'too_many_attempts', 'Muitas tentativas. Tente novamente em 15 minutos ou redefina sua senha.');
    }
  }

  const valid = await verifyPassword(pass, user?.password_hash || DUMMY_HASH);
  if (!user || !valid) {
    await audit(c.env.DB, { action: 'auth.login_failed', entity: 'user', entityId: user?.id, ip: ip(c) });
    throw unauthorized('E-mail, telefone ou senha incorretos.');
  }
  if (user.status === 'bloqueado') throw forbidden('Conta bloqueada. Fale com o suporte.');

  await audit(c.env.DB, { userId: user.id, action: 'auth.login', ip: ip(c) });
  return c.json(await session(c.env, user));
});

auth.post('/google', async (c) => {
  const body = await readJson(c.req.raw);
  const claims = await verifyGoogleIdToken(c.env, str(body, 'id_token', { max: 4096 })!);
  if (!claims) throw unauthorized('Não foi possível confirmar sua conta Google.');

  const db = c.env.DB;
  const existing =
    (await db.prepare('SELECT * FROM users WHERE google_sub = ?').bind(claims.sub).first<UserRow>()) ??
    (await db.prepare('SELECT * FROM users WHERE email = ?').bind(claims.email.toLowerCase()).first<UserRow>());
  const userId = existing?.id ?? newId();

  if (existing) {
    if (existing.status === 'bloqueado') throw forbidden('Conta bloqueada. Fale com o suporte.');
    // Vincula a conta Google e marca o e-mail como verificado (o Google já confirmou).
    await db.prepare('UPDATE users SET google_sub = ?, email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?')
      .bind(claims.sub, now(), userId)
      .run();
  } else {
    const name = (claims.name ?? claims.email.split('@')[0]).slice(0, 120);
    await db.batch([
      db.prepare(
        "INSERT INTO users (id, name, email, password_hash, role, status, google_sub, email_verified_at, accepted_terms_at) VALUES (?, ?, ?, '', 'cliente', 'ativo', ?, ?, ?)",
      ).bind(userId, name, claims.email.toLowerCase(), claims.sub, now(), now()),
      db.prepare('INSERT INTO customers (id, user_id) VALUES (?, ?)').bind(newId(), userId),
    ]);
    await audit(db, { userId, action: 'user.register_google', entity: 'user', entityId: userId, ip: ip(c) });
  }
  const fresh = (await getUser(c.env, userId))!;
  await audit(db, { userId: fresh.id, action: 'auth.login_google', ip: ip(c) });
  return c.json({ ...(await session(c.env, fresh)), is_new: !existing });
});

auth.get('/me', requireAuth(), async (c) => {
  const user = await getUser(c.env, c.get('user').id);
  if (!user) throw notFound();
  return c.json({ user: publicUser(user) });
});

auth.post('/verify/send', requireAuth(), async (c) => {
  const body = await readJson(c.req.raw).catch(() => ({}) as Record<string, unknown>);
  const channel = body.channel === 'whatsapp' ? 'whatsapp' : 'email';
  const user = (await getUser(c.env, c.get('user').id))!;
  return c.json(await deliverCode(c, user, 'verify', channel));
});

auth.post('/verify/confirm', requireAuth(), async (c) => {
  const body = await readJson(c.req.raw);
  const code = str(body, 'code', { min: 6, max: 6 })!;
  const { id } = c.get('user');
  const result = await checkCode(c.env, id, 'verify', code);
  if (!result.ok) throw codeError(result.reason);

  const column = result.channel === 'email' ? 'email_verified_at' : 'phone_verified_at';
  await c.env.DB.prepare(`UPDATE users SET ${column} = ?, updated_at = ? WHERE id = ?`).bind(now(), now(), id).run();
  await audit(c.env.DB, { userId: id, action: 'user.verified', entity: 'user', entityId: id, data: { channel: result.channel } });
  return c.json({ user: publicUser((await getUser(c.env, id))!) });
});

/** Sempre responde igual, exista ou não a conta (não revela quem está cadastrado). */
auth.post('/password/forgot', async (c) => {
  const body = await readJson(c.req.raw);
  const login = loginField(body);
  const channel: Channel = body.channel === 'whatsapp' ? 'whatsapp' : 'email';
  if (!channelsAvailable(c.env)[channel]) throw new ApiError(503, 'channel_unavailable', 'Canal de envio indisponível no momento.');
  const user = await findByLogin(c.env, login);
  let dev: Record<string, unknown> = {};
  if (user && user.status !== 'bloqueado') {
    try {
      const r = await deliverCode(c, user, 'reset', channel);
      if ('dev_code' in r) dev = { dev_code: r.dev_code };
    } catch (e) {
      // Falhas (limite de reenvio, sem telefone) não são reveladas: a resposta é sempre a mesma.
      if (!(e instanceof ApiError)) throw e;
    }
  }
  return c.json({ ok: true, channel, resend_in: RESEND_SECONDS, ...dev });
});

auth.post('/password/reset', async (c) => {
  const body = await readJson(c.req.raw);
  const login = loginField(body);
  const code = str(body, 'code', { min: 6, max: 6 })!;
  const pass = password(body);
  const user = await findByLogin(c.env, login);
  if (!user) throw codeError('invalid');

  const result = await checkCode(c.env, user.id, 'reset', code);
  if (!result.ok) throw codeError(result.reason);

  // Nova senha encerra todas as sessões abertas; o canal usado fica confirmado.
  const column = result.channel === 'email' ? 'email_verified_at' : 'phone_verified_at';
  await c.env.DB.prepare(
    `UPDATE users SET password_hash = ?, token_version = token_version + 1, ${column} = COALESCE(${column}, ?), updated_at = ? WHERE id = ?`,
  )
    .bind(await hashPassword(pass), now(), now(), user.id)
    .run();
  await audit(c.env.DB, { userId: user.id, action: 'auth.password_reset', entity: 'user', entityId: user.id, ip: ip(c) });
  return c.json(await session(c.env, (await getUser(c.env, user.id))!));
});

/** Encerra todas as sessões do usuário (invalida tokens emitidos). */
auth.post('/logout-all', requireAuth(), async (c) => {
  const { id } = c.get('user');
  await c.env.DB.prepare('UPDATE users SET token_version = token_version + 1, updated_at = ? WHERE id = ?').bind(now(), id).run();
  await audit(c.env.DB, { userId: id, action: 'auth.logout_all' });
  return c.json({ ok: true });
});

export default auth;
