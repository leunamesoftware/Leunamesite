import { Hono } from 'hono';

import { audit, requireAuth } from '../lib/auth';
import { newId, verifyPassword } from '../lib/crypto';
import { badRequest, conflict, notFound } from '../lib/errors';
import { unsealRow } from '../lib/fieldCrypto';
import { balance } from '../lib/ledger';
import { rateLimit } from '../lib/rateLimit';
import type { AppEnv } from '../lib/types';
import { readJson, str } from '../lib/validate';

const MAX_ADDRESSES = 10;
const account = new Hono<AppEnv>();

const COLUMNS = 'id, label, street, number, complement, district, city, state, zip, lat, lng, is_default';

account.get('/addresses', requireAuth(), async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT ${COLUMNS} FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC`,
  )
    .bind(c.get('user').id)
    .all();
  return c.json({ items: results });
});

account.post('/addresses', requireAuth(), async (c) => {
  const { id: userId } = c.get('user');
  const b = await readJson(c.req.raw);
  const zip = (str(b, 'zip', { optional: true, max: 9 }) ?? '').replace(/\D/g, '');
  if (zip && zip.length !== 8) throw badRequest('CEP inválido.', 'validation');
  const state = str(b, 'state', { min: 2, max: 2 })!.toUpperCase();
  const num = (k: string, min: number, max: number) => {
    const v = b[k];
    if (v === undefined || v === null) return null;
    if (typeof v !== 'number' || v < min || v > max) throw badRequest(`Campo inválido: ${k}.`, 'validation');
    return v;
  };

  const count = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM addresses WHERE user_id = ?').bind(userId).first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_ADDRESSES) throw badRequest(`Limite de ${MAX_ADDRESSES} endereços atingido.`, 'limit');

  const id = newId();
  const isDefault = b.is_default === true || (count?.n ?? 0) === 0;
  const stmts = [];
  if (isDefault) stmts.push(c.env.DB.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').bind(userId));
  stmts.push(
    c.env.DB.prepare(
      `INSERT INTO addresses (id, user_id, label, street, number, complement, district, city, state, zip, lat, lng, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id,
      userId,
      str(b, 'label', { optional: true, max: 40 }) ?? null,
      str(b, 'street', { min: 2, max: 160 })!,
      str(b, 'number', { optional: true, max: 20 }) ?? null,
      str(b, 'complement', { optional: true, max: 80 }) ?? null,
      str(b, 'district', { optional: true, max: 80 }) ?? null,
      str(b, 'city', { min: 2, max: 80 })!,
      state,
      zip || null,
      num('lat', -90, 90),
      num('lng', -180, 180),
      isDefault ? 1 : 0,
    ),
  );
  await c.env.DB.batch(stmts);
  const row = await c.env.DB.prepare(`SELECT ${COLUMNS} FROM addresses WHERE id = ?`).bind(id).first();
  return c.json({ address: row }, 201);
});

account.delete('/addresses/:id', requireAuth(), async (c) => {
  // Filtra pelo dono: um usuário nunca acessa endereço de outro.
  const res = await c.env.DB.prepare('DELETE FROM addresses WHERE id = ? AND user_id = ?')
    .bind(c.req.param('id'), c.get('user').id)
    .run();
  if (!res.meta.changes) throw notFound('Endereço não encontrado.');
  return c.json({ ok: true });
});

export default account;

/** LGPD: exporta os dados pessoais da conta (JSON). */
account.get('/dados', requireAuth(), async (c) => {
  const id = c.get('user').id;
  const db = c.env.DB;
  const user = await db
    .prepare('SELECT id, name, email, phone, role, cpf, created_at, email_verified_at, phone_verified_at, accepted_terms_at FROM users WHERE id = ?')
    .bind(id)
    .first<{ cpf: string | null }>();
  const [addresses, orders, occurrences, ratings, reviews, notifications] = await db.batch([
    db.prepare(`SELECT ${COLUMNS}, created_at FROM addresses WHERE user_id = ?`).bind(id),
    db.prepare(
      `SELECT o.id, o.status, o.total_cents, o.delivery_fee_cents, o.payment_method, o.created_at, o.delivered_at,
              (SELECT json_group_array(json_object('produto', oi.product_name, 'quantidade', oi.quantity, 'preco_cents', oi.unit_price_cents))
                 FROM order_items oi JOIN order_markets om ON om.id = oi.order_market_id WHERE om.order_id = o.id) AS items
         FROM orders o WHERE o.customer_user_id = ? ORDER BY o.created_at DESC`,
    ).bind(id),
    db.prepare('SELECT id, order_id, type, status, description, refund_cents, created_at FROM occurrences WHERE customer_user_id = ?').bind(id),
    db.prepare('SELECT order_id, to_type, stars, tags, comment, created_at FROM ratings WHERE from_user_id = ?').bind(id),
    db.prepare('SELECT order_id, market_id, rating, comment, created_at FROM market_reviews WHERE user_id = ?').bind(id),
    db.prepare('SELECT title, body, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').bind(id),
  ]);
  const courierRow = await db
    .prepare('SELECT vehicle_type, vehicle_plate, vehicle_model, vehicle_color, cnh_number, birth_date, pix_key, cpf, work_radius_km, status FROM couriers WHERE user_id = ?')
    .bind(id)
    .first<{ cnh_number: string | null; pix_key: string | null; cpf: string | null }>();
  await audit(db, { userId: id, action: 'lgpd.export', entity: 'user', entityId: id });
  c.header('Content-Disposition', 'attachment; filename="econorota-meus-dados.json"');
  return c.json({
    gerado_em: new Date().toISOString(),
    conta: user && (await unsealRow(c.env, user, ['cpf'])),
    enderecos: addresses.results,
    pedidos: (orders.results as { items: string }[]).map((o) => ({ ...o, items: JSON.parse(o.items ?? '[]') })),
    ocorrencias: occurrences.results,
    avaliacoes_feitas: [...ratings.results, ...reviews.results],
    notificacoes: notifications.results,
    entregador: courierRow && (await unsealRow(c.env, courierRow, ['cpf', 'cnh_number', 'pix_key'])),
  });
});

/**
 * LGPD: exclui a conta (cliente ou entregador). Dados pessoais são apagados/anonimizados; pedidos e valores
 * ficam guardados sem identificação, pelo prazo legal (fiscal/contábil). Mercados e administração: pelo suporte.
 */
account.post('/conta/excluir', requireAuth('cliente', 'entregador'), rateLimit('delete_account', 5, 3600), async (c) => {
  const id = c.get('user').id;
  const db = c.env.DB;
  const pass = str(await readJson(c.req.raw), 'password', { min: 1, max: 200 })!;
  const u = await db.prepare('SELECT password_hash FROM users WHERE id = ?').bind(id).first<{ password_hash: string }>();
  if (!u || !(await verifyPassword(pass, u.password_hash))) throw badRequest('Senha incorreta.', 'wrong_password');
  const active = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM orders o LEFT JOIN couriers co ON co.id = o.courier_id
        WHERE (o.customer_user_id = ?1 OR co.user_id = ?1) AND o.status IN ('pago','em_separacao','pronto_coleta','em_rota')`,
    )
    .bind(id)
    .first<{ n: number }>();
  if (active?.n) throw conflict('Há um pedido em andamento. Aguarde a entrega para excluir a conta.', 'active_order');
  const co = await db.prepare('SELECT id, document_photo_key, vehicle_doc_key FROM couriers WHERE user_id = ?').bind(id).first<{
    id: string; document_photo_key: string | null; vehicle_doc_key: string | null;
  }>();
  if (co) {
    const bal = await balance(db, 'entregador', co.id);
    if (bal.available_cents + bal.pending_cents > 0) throw conflict('Você tem valores a receber. Aguarde o repasse para excluir a conta.', 'balance');
    for (const k of [co.document_photo_key, co.vehicle_doc_key]) if (k) await c.env.FILES.delete(k);
  }
  const now = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
  await db.batch([
    db.prepare(
      `UPDATE users SET name = 'Conta excluída', email = ?, phone = NULL, cpf = NULL, google_sub = NULL, asaas_customer_id = NULL,
              password_hash = '!', status = 'bloqueado', token_version = token_version + 1, deleted_at = ${now}, updated_at = ${now} WHERE id = ?`,
    ).bind(`excluido-${id}@econorota.invalid`, id),
    db.prepare('DELETE FROM addresses WHERE user_id = ?').bind(id),
    db.prepare('DELETE FROM push_tokens WHERE user_id = ?').bind(id),
    db.prepare('DELETE FROM notifications WHERE user_id = ?').bind(id),
    // Pedidos antigos ficam só com bairro/cidade (sem rua, número e coordenadas).
    db.prepare(
      `UPDATE orders SET delivery_address = json_object('district', json_extract(delivery_address, '$.district'), 'city', json_extract(delivery_address, '$.city')),
              delivery_lat = NULL, delivery_lng = NULL, delivery_code = NULL WHERE customer_user_id = ?`,
    ).bind(id),
    db.prepare(
      `UPDATE couriers SET cpf = NULL, cnh_number = NULL, pix_key = NULL, birth_date = NULL, vehicle_plate = NULL, document_photo_key = NULL,
              vehicle_doc_key = NULL, lat = NULL, lng = NULL, is_online = 0, status = 'bloqueado' WHERE user_id = ?`,
    ).bind(id),
  ]);
  await audit(db, { userId: id, action: 'lgpd.delete_account', entity: 'user', entityId: id });
  return c.json({ ok: true });
});
