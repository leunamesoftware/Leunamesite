/**
 * Notificações (Fase 16): sempre gravadas na central do app (sino) de cada usuário.
 * Opcionais, só se configurados: push no celular (Firebase Cloud Messaging) e e-mail (Resend) nos eventos importantes.
 * Falha em push/e-mail nunca interrompe a operação principal.
 */
import { newId } from './crypto';
import { sendEmail } from './notify';
import type { Env } from './types';

export const brl = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;

export type Notice = { kind: string; title: string; body: string; link?: string; email?: boolean };

/** Resultado da aprovação do pagamento: pago (cliente + mercados) ou devolvido por falta de estoque. */
export async function onOrderPaid(env: Env, orderId: string, result: string) {
  if (result === 'refunded_no_stock') {
    await notifyCustomer(env, orderId, {
      kind: 'estorno',
      title: 'Produto esgotou durante o pagamento',
      body: 'Um produto acabou enquanto você pagava. Devolvemos o valor integral; monte a lista de novo para comparar.',
      email: true,
    });
    return;
  }
  if (result !== 'approved') return;
  await notifyCustomer(env, orderId, {
    kind: 'pedido_pago',
    title: 'Pagamento aprovado',
    body: 'Seu pedido foi confirmado e os mercados já vão separar os produtos.',
    email: true,
  });
  await notifyOrderMarkets(env, orderId, () => ({
    kind: 'novo_pedido',
    title: 'Novo pedido pago',
    body: 'Aceite e comece a separar. O entregador será avisado quando estiver pronto.',
  }));
}

export async function notifyUsers(env: Env, userIds: (string | null | undefined)[], n: Notice) {
  const ids = [...new Set(userIds.filter((x): x is string => !!x))];
  if (!ids.length) return;
  const db = env.DB;
  await db.batch(
    ids.map((id) =>
      db
        .prepare('INSERT INTO notifications (id, user_id, kind, title, body, link) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(newId(), id, n.kind, n.title.slice(0, 120), n.body.slice(0, 500), n.link ?? null),
    ),
  );
  await Promise.allSettled([sendPush(env, ids, n), n.email ? emailUsers(env, ids, n) : Promise.resolve()]);
}

/** Cliente do pedido. */
export async function notifyCustomer(env: Env, orderId: string, n: Notice) {
  const o = await env.DB.prepare('SELECT customer_user_id FROM orders WHERE id = ?').bind(orderId).first<{ customer_user_id: string }>();
  await notifyUsers(env, [o?.customer_user_id], { link: `/cliente/pedido/${orderId}/rastreio`, ...n });
}

/** Donos dos mercados de um pedido (cada um com o link do seu pedido no painel). */
export async function notifyOrderMarkets(env: Env, orderId: string, n: (marketName: string) => Notice, onlyMarketId?: string) {
  const { results } = await env.DB.prepare(
    `SELECT om.id, m.owner_user_id, m.name FROM order_markets om JOIN markets m ON m.id = om.market_id
      WHERE om.order_id = ? ${onlyMarketId ? 'AND om.market_id = ?' : ''}`,
  )
    .bind(...(onlyMarketId ? [orderId, onlyMarketId] : [orderId]))
    .all<{ id: string; owner_user_id: string; name: string }>();
  for (const r of results) await notifyUsers(env, [r.owner_user_id], { link: `/mercado/pedidos/${r.id}`, ...n(r.name) });
}

export async function notifyCourier(env: Env, courierId: string | null | undefined, n: Notice) {
  if (!courierId) return;
  const c = await env.DB.prepare('SELECT user_id FROM couriers WHERE id = ?').bind(courierId).first<{ user_id: string }>();
  await notifyUsers(env, [c?.user_id], n);
}

export async function notifyMarketOwner(env: Env, marketId: string, n: Notice) {
  const m = await env.DB.prepare('SELECT owner_user_id FROM markets WHERE id = ?').bind(marketId).first<{ owner_user_id: string }>();
  await notifyUsers(env, [m?.owner_user_id], n);
}

/** Equipe administrativa (com acesso à Operação). */
export async function notifyAdmins(env: Env, n: Notice) {
  const { results } = await env.DB.prepare(
    "SELECT id FROM users WHERE role = 'admin' AND status = 'ativo' AND (admin_perms IS NULL OR admin_perms LIKE '%operacao%')",
  ).all<{ id: string }>();
  await notifyUsers(env, results.map((r) => r.id), n);
}

async function emailUsers(env: Env, ids: string[], n: Notice) {
  const { results } = await env.DB.prepare(`SELECT email FROM users WHERE id IN (${ids.map(() => '?').join(',')})`)
    .bind(...ids)
    .all<{ email: string }>();
  for (const r of results) await sendEmail(env, r.email, n.title, n.body).catch(() => undefined);
}

// ── Push (Firebase Cloud Messaging HTTP v1). Ativo só com FCM_PROJECT_ID, FCM_CLIENT_EMAIL e FCM_PRIVATE_KEY. ──
let fcmToken: { value: string; exp: number } | null = null;

const b64url = (data: ArrayBuffer | string) =>
  btoa(typeof data === 'string' ? data : String.fromCharCode(...new Uint8Array(data)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

async function fcmAccessToken(env: Env) {
  if (fcmToken && fcmToken.exp > Date.now() + 60_000) return fcmToken.value;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: env.FCM_CLIENT_EMAIL,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const pem = env.FCM_PRIVATE_KEY!.replace(/\\n/g, '\n').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const key = await crypto.subtle.importKey(
    'pkcs8',
    Uint8Array.from(atob(pem), (ch) => ch.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${header}.${claims}.${b64url(sig)}`,
  });
  if (!res.ok) throw new Error(`FCM auth ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  fcmToken = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return fcmToken.value;
}

async function sendPush(env: Env, userIds: string[], n: Notice) {
  if (!env.FCM_PROJECT_ID || !env.FCM_CLIENT_EMAIL || !env.FCM_PRIVATE_KEY) return;
  const { results } = await env.DB.prepare(`SELECT token FROM push_tokens WHERE user_id IN (${userIds.map(() => '?').join(',')})`)
    .bind(...userIds)
    .all<{ token: string }>();
  if (!results.length) return;
  const access = await fcmAccessToken(env);
  for (const { token } of results) {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${env.FCM_PROJECT_ID}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: { token, notification: { title: n.title, body: n.body }, data: { link: n.link ?? '', kind: n.kind } },
      }),
    });
    // Token inválido (app desinstalado): remove.
    if (res.status === 404 || res.status === 400) await env.DB.prepare('DELETE FROM push_tokens WHERE token = ?').bind(token).run();
  }
}
