/**
 * Livro-razão (Fase 15). Na entrega, o valor de cada pedido é dividido:
 *  - mercado: + produtos entregues (itens em falta já foram reembolsados ao cliente) − comissão;
 *  - entregador: + parte da entrega (COURIER_SHARE_PCT);
 *  - plataforma: + comissão + restante da entrega.
 * O valor do mercado fica disponível para repasse depois do prazo de reclamação de produto (market_hold_days);
 * o do entregador, na hora. Reembolsos depois da entrega viram débito de quem causou o problema.
 */
import { newId } from './crypto';
import { getSettings } from './settings';
import type { Env } from './types';

export const PLATFORM = 'econorota';
const PRODUCT_ISSUES = new Set(['produto_errado', 'produto_faltando', 'produto_indisponivel', 'substituicao_nao_autorizada']);
const iso = (d: Date) => d.toISOString();

export async function settleDelivered(env: Env, orderId: string) {
  const db = env.DB;
  const o = await db
    .prepare('SELECT id, courier_id, delivery_fee_cents, courier_earning_cents FROM orders WHERE id = ? AND status = ?')
    .bind(orderId, 'entregue')
    .first<{ id: string; courier_id: string | null; delivery_fee_cents: number; courier_earning_cents: number | null }>();
  if (!o) return;
  const s = await getSettings(env);
  const { results: markets } = await db
    .prepare(
      `SELECT om.market_id, COALESCE(SUM(CASE WHEN COALESCE(oi.checked, 1) = 1 THEN oi.unit_price_cents * oi.quantity END), 0) AS sold
         FROM order_markets om LEFT JOIN order_items oi ON oi.order_market_id = om.id
        WHERE om.order_id = ? AND om.status != 'cancelado' GROUP BY om.market_id`,
    )
    .bind(orderId)
    .all<{ market_id: string; sold: number }>();
  const now = new Date();
  const marketAvailable = iso(new Date(now.getTime() + s.market_hold_days * 86400_000));
  const rows: [string, string, string, number, string, string][] = [];
  let commissionTotal = 0;
  for (const m of markets) {
    const commission = Math.round((m.sold * s.commission_pct) / 100);
    commissionTotal += commission;
    rows.push(['mercado', m.market_id, 'venda', m.sold, marketAvailable, 'Produtos entregues']);
    rows.push(['mercado', m.market_id, 'comissao', -commission, marketAvailable, `Comissão ${s.commission_pct}%`]);
  }
  const courierCents = o.courier_earning_cents ?? Math.round((o.delivery_fee_cents * s.courier_share_pct) / 100);
  if (o.courier_id) rows.push(['entregador', o.courier_id, 'entrega', courierCents, iso(now), 'Entrega']);
  rows.push(['plataforma', PLATFORM, 'comissao', commissionTotal, iso(now), 'Comissão dos mercados']);
  rows.push(['plataforma', PLATFORM, 'taxa_plataforma', o.delivery_fee_cents - (o.courier_id ? courierCents : 0), iso(now), 'Parte da entrega']);
  await db.batch(
    rows.map(([type, id, kind, cents, available, note]) =>
      db
        .prepare(
          `INSERT OR IGNORE INTO ledger_entries (id, order_id, party_type, party_id, kind, amount_cents, available_at, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(newId(), orderId, type, id, kind, cents, available, note),
    ),
  );
}

/**
 * Reembolso depois da entrega: quem arca? Problema no produto → mercado da ocorrência; entrega/reclamação → plataforma.
 * Antes da entrega nada foi liquidado, então não há lançamento.
 */
export async function chargeRefund(env: Env, orderId: string, cents: number, occurrence: { type: string; market_id: string | null; id: string }) {
  if (cents <= 0) return;
  const db = env.DB;
  const settled = await db.prepare("SELECT 1 FROM ledger_entries WHERE order_id = ? AND kind = 'venda' LIMIT 1").bind(orderId).first();
  if (!settled) return;
  const market = PRODUCT_ISSUES.has(occurrence.type) && occurrence.market_id;
  await db
    .prepare(
      `INSERT INTO ledger_entries (id, order_id, party_type, party_id, kind, amount_cents, available_at, note)
       VALUES (?, ?, ?, ?, 'reembolso', ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), ?)`,
    )
    .bind(newId(), orderId, market ? 'mercado' : 'plataforma', market || PLATFORM, -cents, `Reembolso da ocorrência ${occurrence.id.slice(0, 6)}`)
    .run();
}

/** Saldo de uma parte: disponível (liberado e ainda não repassado), a liberar e já repassado. */
export async function balance(db: D1Database, partyType: string, partyId: string) {
  return (await db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN payout_id IS NULL AND available_at <= strftime('%Y-%m-%dT%H:%M:%fZ','now') THEN amount_cents END), 0) AS available_cents,
              COALESCE(SUM(CASE WHEN payout_id IS NULL AND available_at > strftime('%Y-%m-%dT%H:%M:%fZ','now') THEN amount_cents END), 0) AS pending_cents,
              COALESCE(SUM(CASE WHEN payout_id IS NOT NULL THEN amount_cents END), 0) AS paid_out_cents
         FROM ledger_entries WHERE party_type = ? AND party_id = ?`,
    )
    .bind(partyType, partyId)
    .first<{ available_cents: number; pending_cents: number; paid_out_cents: number }>())!;
}

/** Extrato (últimos lançamentos). */
export async function statement(db: D1Database, partyType: string, partyId: string, limit = 100) {
  const { results } = await db
    .prepare(
      `SELECT l.id, l.order_id, l.kind, l.amount_cents, l.note, l.available_at, l.created_at, l.payout_id, p.status AS payout_status
         FROM ledger_entries l LEFT JOIN payouts p ON p.id = l.payout_id
        WHERE l.party_type = ? AND l.party_id = ? ORDER BY l.created_at DESC LIMIT ?`,
    )
    .bind(partyType, partyId, limit)
    .all();
  return results;
}

export async function payoutsOf(db: D1Database, partyType: string, partyId: string) {
  const { results } = await db
    .prepare('SELECT id, amount_cents, status, reference, created_at, paid_at FROM payouts WHERE party_type = ? AND party_id = ? ORDER BY created_at DESC LIMIT 50')
    .bind(partyType, partyId)
    .all();
  return results;
}
