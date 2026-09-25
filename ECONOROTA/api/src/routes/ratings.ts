import { Hono, type Context } from 'hono';

import { requireAuth } from '../lib/auth';
import { newId } from '../lib/crypto';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors';
import type { AppEnv, Role } from '../lib/types';
import { readJson, str } from '../lib/validate';

/**
 * Avaliações (Fase 12): cliente → mercado/entregador, entregador → cliente/mercado, mercado → cliente/entregador.
 * Só quem participou do pedido, depois da entrega e até 7 dias.
 */
const ratings = new Hono<AppEnv>();
ratings.use('*', requireAuth('cliente', 'mercado', 'entregador'));

type Target = 'mercado' | 'entregador' | 'cliente';
const WINDOW_MS = 7 * 86400_000;

export const TAGS: Record<string, string[]> = {
  'cliente>mercado': ['Produtos frescos', 'Bem embalado', 'Preço justo', 'Faltou item', 'Produto errado', 'Embalagem ruim'],
  'cliente>entregador': ['Educado', 'Pontual', 'Cuidado com os produtos', 'Atrasou', 'Não seguiu as instruções'],
  'entregador>cliente': ['Educado', 'Endereço fácil', 'Atendeu rápido', 'Demorou a atender', 'Endereço difícil'],
  'entregador>mercado': ['Pedido pronto na hora', 'Bem embalado', 'Atendimento rápido', 'Demora no balcão', 'Pedido incompleto'],
  'mercado>cliente': ['Educado', 'Pedido claro', 'Pagamento sem problemas'],
  'mercado>entregador': ['Pontual', 'Educado', 'Conferiu direitinho', 'Atrasou na retirada'],
};

async function participants(c: Context<AppEnv>, orderId: string) {
  const db = c.env.DB;
  const o = await db
    .prepare(
      `SELECT o.id, o.status, o.delivered_at, o.customer_user_id, o.courier_id, cu.user_id AS courier_user_id, u.name AS customer_name,
              cu_u.name AS courier_name
         FROM orders o JOIN users u ON u.id = o.customer_user_id
         LEFT JOIN couriers cu ON cu.id = o.courier_id LEFT JOIN users cu_u ON cu_u.id = cu.user_id
        WHERE o.id = ?`,
    )
    .bind(orderId)
    .first<{ id: string; status: string; delivered_at: string | null; customer_user_id: string; courier_id: string | null; courier_user_id: string | null; customer_name: string; courier_name: string | null }>();
  if (!o) throw notFound('Pedido não encontrado.');
  const { results: markets } = await db
    .prepare('SELECT m.id, m.name, m.owner_user_id FROM order_markets om JOIN markets m ON m.id = om.market_id WHERE om.order_id = ? ORDER BY om.sequence')
    .bind(orderId)
    .all<{ id: string; name: string; owner_user_id: string }>();
  const user = c.get('user');
  const role = user.role as Role;
  const mine =
    (role === 'cliente' && o.customer_user_id === user.id) ||
    (role === 'entregador' && o.courier_user_id === user.id) ||
    (role === 'mercado' && markets.some((m) => m.owner_user_id === user.id));
  if (!mine) throw notFound('Pedido não encontrado.');
  const targets: { type: Target; id: string; name: string }[] = [];
  const first = (n: string | null) => (n ?? '').split(' ')[0];
  if (role === 'cliente') {
    for (const m of markets) targets.push({ type: 'mercado', id: m.id, name: m.name });
    if (o.courier_id) targets.push({ type: 'entregador', id: o.courier_id, name: first(o.courier_name) });
  } else if (role === 'entregador') {
    targets.push({ type: 'cliente', id: o.customer_user_id, name: first(o.customer_name) });
    for (const m of markets) targets.push({ type: 'mercado', id: m.id, name: m.name });
  } else {
    targets.push({ type: 'cliente', id: o.customer_user_id, name: first(o.customer_name) });
    if (o.courier_id) targets.push({ type: 'entregador', id: o.courier_id, name: first(o.courier_name) });
  }
  return { o, role: role as 'cliente' | 'mercado' | 'entregador', targets };
}

/** O que falta avaliar neste pedido (com as etiquetas de cada tipo). */
ratings.get('/pedidos/:id', async (c) => {
  const { o, role, targets } = await participants(c, c.req.param('id'));
  const open = o.status === 'entregue' && !!o.delivered_at && Date.now() - Date.parse(o.delivered_at) < WINDOW_MS;
  const db = c.env.DB;
  const done = new Set<string>();
  const { results } = await db.prepare('SELECT to_type, to_id FROM ratings WHERE order_id = ? AND from_user_id = ?').bind(o.id, c.get('user').id).all<{ to_type: string; to_id: string }>();
  for (const r of results) done.add(`${r.to_type}:${r.to_id}`);
  if (role === 'cliente') {
    const { results: mr } = await db.prepare('SELECT market_id FROM market_reviews WHERE order_id = ? AND user_id = ?').bind(o.id, c.get('user').id).all<{ market_id: string }>();
    for (const r of mr) done.add(`mercado:${r.market_id}`);
  }
  return c.json({
    open,
    targets: targets.map((t) => ({ ...t, done: done.has(`${t.type}:${t.id}`), tags: TAGS[`${role}>${t.type}`] ?? [] })),
  });
});

/** Envia uma avaliação. */
ratings.post('/', async (c) => {
  const b = await readJson(c.req.raw);
  const orderId = str(b, 'pedido', { max: 64 })!;
  const { o, role, targets } = await participants(c, orderId);
  if (o.status !== 'entregue' || !o.delivered_at) throw conflict('Avaliações ficam disponíveis depois da entrega.', 'not_delivered');
  if (Date.now() - Date.parse(o.delivered_at) > WINDOW_MS) throw conflict('O prazo para avaliar este pedido terminou (7 dias).', 'too_late');
  const type = str(b, 'alvo_tipo', { max: 12 }) as Target;
  const id = str(b, 'alvo_id', { max: 64 })!;
  if (!targets.some((t) => t.type === type && t.id === id)) throw forbidden('Você não pode avaliar este participante.');
  const stars = Number(b.estrelas);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw badRequest('Escolha de 1 a 5 estrelas.', 'validation');
  const allowed = TAGS[`${role}>${type}`] ?? [];
  const tags = Array.isArray(b.tags) ? [...new Set((b.tags as unknown[]).filter((t): t is string => typeof t === 'string'))] : [];
  if (tags.some((t) => !allowed.includes(t))) throw badRequest('Etiqueta inválida.', 'validation');
  const comment = str(b, 'comentario', { max: 500, optional: true }) ?? null;
  const db = c.env.DB;
  const userId = c.get('user').id;

  if (role === 'cliente' && type === 'mercado') {
    // Pública (aparece na loja do mercado) e atualiza a nota do mercado.
    const r = await db
      .prepare('INSERT OR IGNORE INTO market_reviews (id, market_id, user_id, order_id, rating, comment, tags) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(newId(), id, userId, orderId, stars, comment, JSON.stringify(tags))
      .run();
    if (!r.meta.changes) throw conflict('Você já avaliou este mercado neste pedido.', 'duplicate');
    await db
      .prepare(
        `UPDATE markets SET rating = (SELECT ROUND(AVG(rating), 1) FROM market_reviews WHERE market_id = ?1 AND hidden = 0),
                             rating_count = (SELECT COUNT(*) FROM market_reviews WHERE market_id = ?1 AND hidden = 0) WHERE id = ?1`,
      )
      .bind(id)
      .run();
  } else {
    const r = await db
      .prepare('INSERT OR IGNORE INTO ratings (id, order_id, from_user_id, from_role, to_type, to_id, stars, tags, comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(newId(), orderId, userId, role, type, id, stars, JSON.stringify(tags), comment)
      .run();
    if (!r.meta.changes) throw conflict('Você já fez esta avaliação.', 'duplicate');
    if (type === 'entregador' || type === 'cliente') {
      const table = type === 'entregador' ? 'couriers' : 'customers';
      const col = type === 'entregador' ? 'id' : 'user_id';
      await db
        .prepare(
          `UPDATE ${table} SET rating = (SELECT ROUND(AVG(stars), 1) FROM ratings WHERE to_type = ?1 AND to_id = ?2 AND hidden = 0),
                                rating_count = (SELECT COUNT(*) FROM ratings WHERE to_type = ?1 AND to_id = ?2 AND hidden = 0) WHERE ${col} = ?2`,
        )
        .bind(type, id)
        .run();
    }
  }
  return c.json({ ok: true }, 201);
});

/** Avaliações que eu fiz. */
ratings.get('/minhas', async (c) => {
  const userId = c.get('user').id;
  const { results } = await c.env.DB.prepare(
    `SELECT order_id, 'mercado' AS to_type, market_id AS to_id, (SELECT name FROM markets WHERE id = market_id) AS to_name, rating AS stars, comment, created_at
       FROM market_reviews WHERE user_id = ?1
     UNION ALL
     SELECT order_id, to_type, to_id,
            CASE to_type WHEN 'mercado' THEN (SELECT name FROM markets WHERE id = to_id)
                         WHEN 'entregador' THEN (SELECT u.name FROM couriers co JOIN users u ON u.id = co.user_id WHERE co.id = to_id)
                         ELSE (SELECT name FROM users WHERE id = to_id) END,
            stars, comment, created_at
       FROM ratings WHERE from_user_id = ?1
     ORDER BY created_at DESC LIMIT 100`,
  )
    .bind(userId)
    .all<{ to_name: string | null; to_type: string }>();
  // Primeiro nome para pessoas (privacidade).
  return c.json({
    items: results.map((r) => ({ ...r, to_name: r.to_type === 'mercado' ? r.to_name : (r.to_name ?? '').split(' ')[0] })),
  });
});

export default ratings;
