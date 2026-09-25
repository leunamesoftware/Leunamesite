import { Hono, type Context } from 'hono';

import { audit, requireAuth } from '../lib/auth';
import { newId } from '../lib/crypto';
import { readImage, streamFile } from '../lib/files';
import { badRequest, conflict, notFound } from '../lib/errors';
import { notifyAdmins, notifyMarketOwner } from '../lib/notifications';
import type { AppEnv } from '../lib/types';
import { oneOf, readJson, str } from '../lib/validate';

/**
 * Ocorrências do cliente (Fase 11): produto errado, faltando, indisponível, substituição não autorizada,
 * entrega atrasada, pedido não entregue e reclamação — com evidências (fotos) e histórico.
 */
const occurrences = new Hono<AppEnv>();

export const TYPES = [
  'produto_errado',
  'produto_faltando',
  'produto_indisponivel',
  'substituicao_nao_autorizada',
  'entrega_atrasada',
  'pedido_nao_entregue',
  'reclamacao',
] as const;
const PRODUCT_TYPES = new Set<string>(['produto_errado', 'produto_faltando', 'produto_indisponivel', 'substituicao_nao_autorizada']);
const MAX_EVIDENCE = 5;
const HOURS = (h: number) => h * 3600_000;

export async function event(db: D1Database, occId: string, role: string, authorId: string | null, kind: string, message?: string | null) {
  await db
    .prepare('INSERT INTO occurrence_events (id, occurrence_id, author_role, author_id, kind, message) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(newId(), occId, role, authorId, kind, message ?? null)
    .run();
}

/** Detalhe completo (usado pelo cliente e pela administração). */
export async function occurrenceDetail(db: D1Database, id: string) {
  const o = await db
    .prepare(
      `SELECT oc.*, m.name AS market_name FROM occurrences oc LEFT JOIN markets m ON m.id = oc.market_id WHERE oc.id = ?`,
    )
    .bind(id)
    .first<Record<string, unknown> & { order_id: string }>();
  if (!o) return null;
  const [{ results: items }, { results: evidence }, { results: events }] = await Promise.all([
    db
      .prepare(
        `SELECT oi.id, oi.product_name AS name, oi.unit_price_cents, oci.quantity FROM occurrence_items oci
           JOIN order_items oi ON oi.id = oci.order_item_id WHERE oci.occurrence_id = ?`,
      )
      .bind(id)
      .all(),
    db.prepare('SELECT id, content_type, created_at FROM occurrence_evidence WHERE occurrence_id = ? ORDER BY created_at').bind(id).all(),
    db.prepare('SELECT author_role, kind, message, created_at FROM occurrence_events WHERE occurrence_id = ? ORDER BY created_at').bind(id).all(),
  ]);
  return { ...o, items, evidence, events };
}

async function mine(c: Context<AppEnv>) {
  const o = await c.env.DB.prepare('SELECT id, status FROM occurrences WHERE id = ? AND customer_user_id = ?')
    .bind(c.req.param('id'), c.get('user').id)
    .first<{ id: string; status: string }>();
  if (!o) throw notFound('Ocorrência não encontrada.');
  return o;
}

/** Abre uma ocorrência sobre um pedido do próprio cliente. */
occurrences.post('/orders/:id/ocorrencias', requireAuth('cliente'), async (c) => {
  const db = c.env.DB;
  const userId = c.get('user').id;
  const order = await db
    .prepare('SELECT id, status, paid_at, delivered_at, eta_max_min, created_at FROM orders WHERE id = ? AND customer_user_id = ?')
    .bind(c.req.param('id'), userId)
    .first<{ id: string; status: string; paid_at: string | null; delivered_at: string | null; eta_max_min: number | null; created_at: string }>();
  if (!order) throw notFound('Pedido não encontrado.');
  const b = await readJson(c.req.raw);
  const type = oneOf(b, 'tipo', TYPES);
  const description = str(b, 'descricao', { max: 1000, optional: type !== 'reclamacao' }) ?? null;
  const now = Date.now();

  // Prazos: produto (48 h após a entrega); atraso/não entregue (a partir do prazo prometido); reclamação (7 dias).
  if (!order.paid_at) throw conflict('Este pedido ainda não foi pago.', 'not_paid');
  const deliveredMs = order.delivered_at ? Date.parse(order.delivered_at) : null;
  const promisedMs = Date.parse(order.paid_at) + (order.eta_max_min ?? 60) * 60_000;
  if (PRODUCT_TYPES.has(type)) {
    if (order.status !== 'entregue' || !deliveredMs) throw conflict('Problemas com produtos podem ser relatados depois da entrega.', 'not_delivered');
    if (now - deliveredMs > HOURS(48)) throw conflict('O prazo para relatar problemas com produtos é de 48 horas após a entrega.', 'too_late');
  } else if (type === 'entrega_atrasada' || type === 'pedido_nao_entregue') {
    if (!['em_separacao', 'pronto_coleta', 'em_rota', 'entregue'].includes(order.status) && order.status !== 'pago') {
      throw conflict('Este pedido não está em entrega.', 'invalid_state');
    }
    if (now < promisedMs) throw conflict('O pedido ainda está dentro do prazo de entrega. Acompanhe pelo rastreamento.', 'on_time');
    if (deliveredMs && now - deliveredMs > HOURS(48)) throw conflict('Prazo para esta ocorrência encerrado.', 'too_late');
  } else if (now - Date.parse(order.paid_at) > HOURS(24 * 7)) {
    throw conflict('O prazo para reclamações sobre este pedido terminou (7 dias).', 'too_late');
  }

  const dup = await db
    .prepare("SELECT 1 FROM occurrences WHERE order_id = ? AND type = ? AND status IN ('aberta','em_analise')")
    .bind(order.id, type)
    .first();
  if (dup) throw conflict('Já existe uma ocorrência deste tipo em análise para este pedido.', 'duplicate');

  // Itens do pedido afetados (obrigatório nos tipos de produto).
  const list = Array.isArray(b.itens) ? (b.itens as { id?: unknown; quantidade?: unknown }[]) : [];
  let requested = 0;
  let marketId: string | null = null;
  const rows: { id: string; qty: number }[] = [];
  if (PRODUCT_TYPES.has(type)) {
    if (!list.length) throw badRequest('Escolha os produtos com problema.', 'validation');
    const { results: items } = await db
      .prepare(
        `SELECT oi.id, oi.quantity, oi.unit_price_cents, om.market_id FROM order_items oi
           JOIN order_markets om ON om.id = oi.order_market_id WHERE om.order_id = ? AND COALESCE(oi.checked, 1) = 1`,
      )
      .bind(order.id)
      .all<{ id: string; quantity: number; unit_price_cents: number; market_id: string }>();
    const byId = new Map(items.map((i) => [i.id, i]));
    for (const it of list) {
      const item = typeof it.id === 'string' ? byId.get(it.id) : undefined;
      const qty = Number(it.quantidade ?? 1);
      if (!item || !Number.isInteger(qty) || qty < 1 || qty > item.quantity) throw badRequest('Produto inválido na ocorrência.', 'validation');
      rows.push({ id: item.id, qty });
      requested += item.unit_price_cents * qty;
      marketId ??= item.market_id;
    }
  }

  const id = newId();
  await db.batch([
    db
      .prepare('INSERT INTO occurrences (id, order_id, customer_user_id, market_id, type, description, requested_cents) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, order.id, userId, marketId, type, description, requested),
    ...rows.map((r) => db.prepare('INSERT INTO occurrence_items (occurrence_id, order_item_id, quantity) VALUES (?, ?, ?)').bind(id, r.id, r.qty)),
    db
      .prepare("INSERT INTO occurrence_events (id, occurrence_id, author_role, author_id, kind, message) VALUES (?, ?, 'cliente', ?, 'aberta', ?)")
      .bind(newId(), id, userId, description),
  ]);
  await audit(db, { userId, action: 'occurrence.open', entity: 'occurrence', entityId: id, data: { type, order: order.id } });
  await notifyAdmins(c.env, { kind: 'ocorrencia', title: 'Nova ocorrência', body: 'Um cliente relatou um problema no pedido.', link: `/admin/ocorrencias/${id}` });
  if (marketId) {
    await notifyMarketOwner(c.env, marketId, {
      kind: 'ocorrencia',
      title: 'Cliente relatou um problema',
      body: 'Há uma ocorrência sobre produtos do seu mercado. A equipe EconoRota vai analisar.',
      link: '/mercado/pedidos',
    });
  }
  return c.json({ occurrence: await occurrenceDetail(db, id) }, 201);
});

/** Evidências (fotos): até 5 por ocorrência, só enquanto está aberta. */
occurrences.put('/ocorrencias/:id/evidencias', requireAuth('cliente'), async (c) => {
  const o = await mine(c);
  if (o.status !== 'aberta' && o.status !== 'em_analise') throw conflict('Ocorrência encerrada.', 'closed');
  const n = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM occurrence_evidence WHERE occurrence_id = ?').bind(o.id).first<{ n: number }>();
  if ((n?.n ?? 0) >= MAX_EVIDENCE) throw badRequest(`Máximo de ${MAX_EVIDENCE} fotos por ocorrência.`, 'limit');
  const { buf, type, ext } = await readImage(c);
  const key = `occurrences/${o.id}/${newId()}.${ext}`;
  await c.env.FILES.put(key, buf, { httpMetadata: { contentType: type } });
  const eid = newId();
  await c.env.DB.prepare('INSERT INTO occurrence_evidence (id, occurrence_id, file_key, content_type, uploaded_by) VALUES (?, ?, ?, ?, ?)')
    .bind(eid, o.id, key, type, c.get('user').id)
    .run();
  await event(c.env.DB, o.id, 'cliente', c.get('user').id, 'evidencia');
  return c.json({ id: eid }, 201);
});

occurrences.get('/ocorrencias/:id/evidencias/:eid', requireAuth('cliente'), async (c) => {
  const o = await mine(c);
  const e = await c.env.DB.prepare('SELECT file_key FROM occurrence_evidence WHERE id = ? AND occurrence_id = ?')
    .bind(c.req.param('eid'), o.id)
    .first<{ file_key: string }>();
  const res = e ? await streamFile(c.env.FILES, e.file_key) : null;
  if (!res) throw notFound();
  return res;
});

/** Mensagem do cliente na ocorrência (complemento). */
occurrences.post('/ocorrencias/:id/mensagens', requireAuth('cliente'), async (c) => {
  const o = await mine(c);
  if (o.status === 'resolvida' || o.status === 'recusada') throw conflict('Ocorrência encerrada.', 'closed');
  const msg = str(await readJson(c.req.raw), 'mensagem', { min: 2, max: 1000 })!;
  await event(c.env.DB, o.id, 'cliente', c.get('user').id, 'mensagem', msg);
  return c.json({ ok: true });
});

/** Histórico de ocorrências do cliente. */
occurrences.get('/ocorrencias', requireAuth(), async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, order_id, type, status, resolution, requested_cents, refund_cents, created_at, resolved_at, auto
       FROM occurrences WHERE customer_user_id = ? ORDER BY created_at DESC LIMIT 100`,
  )
    .bind(c.get('user').id)
    .all();
  return c.json({ items: results });
});

occurrences.get('/ocorrencias/:id', requireAuth(), async (c) => {
  await mine(c);
  return c.json({ occurrence: await occurrenceDetail(c.env.DB, c.req.param('id')) });
});

export default occurrences;
