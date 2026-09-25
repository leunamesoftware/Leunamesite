import { Hono } from 'hono';

import { audit, requireAuth } from '../lib/auth';
import { streamFile } from '../lib/files';
import { badRequest, conflict, notFound } from '../lib/errors';
import { chargeRefund } from '../lib/ledger';
import { brl, notifyCustomer } from '../lib/notifications';
import { refundPartial } from '../lib/refunds';
import type { AppEnv } from '../lib/types';
import { oneOf, readJson, str } from '../lib/validate';
import panel, { perm } from './adminPanel';
import { event, occurrenceDetail } from './occurrences';

/** Painel administrativo (Fases 11 e 13). */
const admin = new Hono<AppEnv>();
admin.use('*', requireAuth('admin'));
admin.use('/ocorrencias', perm('operacao'));
admin.use('/ocorrencias/*', perm('operacao'));

/** Ocorrências para análise (fila: abertas primeiro). */
admin.get('/ocorrencias', async (c) => {
  const status = c.req.query('status');
  if (status && !['aberta', 'em_analise', 'resolvida', 'recusada'].includes(status)) throw badRequest('Filtro inválido.', 'validation');
  const { results } = await c.env.DB.prepare(
    `SELECT oc.id, oc.order_id, oc.type, oc.status, oc.resolution, oc.requested_cents, oc.refund_cents, oc.created_at, oc.auto,
            u.name AS customer_name, m.name AS market_name,
            (SELECT COUNT(*) FROM occurrence_evidence e WHERE e.occurrence_id = oc.id) AS evidence_count
       FROM occurrences oc JOIN users u ON u.id = oc.customer_user_id LEFT JOIN markets m ON m.id = oc.market_id
      ${status ? 'WHERE oc.status = ?' : ''}
      ORDER BY CASE oc.status WHEN 'aberta' THEN 0 WHEN 'em_analise' THEN 1 ELSE 2 END, oc.created_at DESC LIMIT 200`,
  )
    .bind(...(status ? [status] : []))
    .all();
  return c.json({ items: results });
});

admin.get('/ocorrencias/:id', async (c) => {
  const d = await occurrenceDetail(c.env.DB, c.req.param('id'));
  if (!d) throw notFound('Ocorrência não encontrada.');
  const order = await c.env.DB.prepare(
    `SELECT o.id, o.status, o.total_cents, o.delivery_fee_cents, o.paid_at, o.delivered_at, u.name AS customer_name, u.email AS customer_email,
            (SELECT refunded_cents FROM payments p WHERE p.order_id = o.id AND p.status = 'aprovado' ORDER BY created_at DESC LIMIT 1) AS refunded_cents
       FROM orders o JOIN users u ON u.id = o.customer_user_id WHERE o.id = ?`,
  )
    .bind(d.order_id as string)
    .first();
  return c.json({ occurrence: d, order });
});

admin.get('/ocorrencias/:id/evidencias/:eid', async (c) => {
  const e = await c.env.DB.prepare('SELECT file_key FROM occurrence_evidence WHERE id = ? AND occurrence_id = ?')
    .bind(c.req.param('eid'), c.req.param('id'))
    .first<{ file_key: string }>();
  const res = e ? await streamFile(c.env.FILES, e.file_key) : null;
  if (!res) throw notFound();
  return res;
});

/** Análise administrativa: assumir a ocorrência. */
admin.post('/ocorrencias/:id/analisar', async (c) => {
  const r = await c.env.DB.prepare("UPDATE occurrences SET status = 'em_analise', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND status = 'aberta'")
    .bind(c.req.param('id'))
    .run();
  if (!r.meta.changes) throw conflict('Ocorrência não está aberta.', 'invalid_state');
  await event(c.env.DB, c.req.param('id'), 'admin', c.get('user').id, 'em_analise');
  return c.json({ ok: true });
});

/** Decisão: reembolso total, parcial ou sem reembolso (o valor sai do pagamento do pedido). */
admin.post('/ocorrencias/:id/decidir', async (c) => {
  const db = c.env.DB;
  const o = await db.prepare('SELECT id, order_id, status, requested_cents, type, market_id FROM occurrences WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ id: string; order_id: string; status: string; requested_cents: number; type: string; market_id: string | null }>();
  if (!o) throw notFound('Ocorrência não encontrada.');
  if (o.status === 'resolvida' || o.status === 'recusada') throw conflict('Ocorrência já decidida.', 'closed');
  const b = await readJson(c.req.raw);
  const resolution = oneOf(b, 'resolucao', ['reembolso_total', 'reembolso_parcial', 'sem_reembolso'] as const);
  const note = str(b, 'nota', { min: 3, max: 1000 })!;
  const order = await db.prepare('SELECT total_cents FROM orders WHERE id = ?').bind(o.order_id).first<{ total_cents: number }>();
  let cents = 0;
  if (resolution === 'reembolso_total') cents = order!.total_cents;
  if (resolution === 'reembolso_parcial') {
    cents = Number(b.valor_cents ?? o.requested_cents);
    if (!Number.isInteger(cents) || cents <= 0 || cents > order!.total_cents) throw badRequest('Valor de reembolso inválido.', 'validation');
  }
  const refunded = cents > 0 ? await refundPartial(c.env, o.order_id, cents, `ocorrencia:${o.id}`, c.get('user').id) : 0;
  await chargeRefund(c.env, o.order_id, refunded, o);
  await db
    .prepare(
      `UPDATE occurrences SET status = ?, resolution = ?, refund_cents = ?, admin_note = ?, resolved_by = ?,
              resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
    )
    .bind(resolution === 'sem_reembolso' ? 'recusada' : 'resolvida', resolution, refunded, note, c.get('user').id, o.id)
    .run();
  await event(db, o.id, 'admin', c.get('user').id, resolution, note);
  await audit(db, { userId: c.get('user').id, action: 'occurrence.decide', entity: 'occurrence', entityId: o.id, data: { resolution, refunded } });
  await notifyCustomer(c.env, o.order_id, {
    kind: 'ocorrencia',
    title: refunded > 0 ? `Ocorrência resolvida: ${brl(refunded)} devolvidos` : 'Ocorrência analisada',
    body: note,
    link: `/cliente/ocorrencias/${o.id}`,
    email: true,
  });
  return c.json({ occurrence: await occurrenceDetail(db, o.id) });
});

admin.route('/', panel);

export default admin;
