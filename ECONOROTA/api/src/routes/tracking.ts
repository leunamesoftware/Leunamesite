import { Hono } from 'hono';

import { requireAuth } from '../lib/auth';
import { notFound } from '../lib/errors';
import { distanceKm } from '../lib/geo';
import type { AppEnv } from '../lib/types';

/**
 * Rastreamento (Fase 10): mapa, posição do entregador, rota, status por mercado, farol e previsão de chegada.
 * Só o dono do pedido acessa; a posição do entregador só aparece enquanto ele está com o pedido.
 */
const tracking = new Hono<AppEnv>();

const SPEED_KMH = 25;
const PICKUP_MIN = 5;
const STALE_WARN_S = 120;
const STALE_BAD_S = 300;

tracking.get('/orders/:id/rastreio', requireAuth(), async (c) => {
  const db = c.env.DB;
  const o = await db
    .prepare(
      `SELECT o.id, o.status, o.courier_status, o.courier_id, o.delivery_lat, o.delivery_lng, o.eta_max_min, o.created_at, o.paid_at,
              o.delivered_at, o.cancel_reason, o.delivery_code
         FROM orders o WHERE o.id = ? AND o.customer_user_id = ?`,
    )
    .bind(c.req.param('id'), c.get('user').id)
    .first<{
      id: string; status: string; courier_status: string | null; courier_id: string | null; delivery_lat: number; delivery_lng: number;
      eta_max_min: number | null; created_at: string; paid_at: string | null; delivered_at: string | null; cancel_reason: string | null;
      delivery_code: string | null;
    }>();
  if (!o) throw notFound('Pedido não encontrado.');

  const { results: stops } = await db
    .prepare(
      `SELECT om.id, om.sequence, om.status, om.ready_at, om.picked_at, om.courier_arrived_at, m.name, m.image_url, m.lat, m.lng
         FROM order_markets om JOIN markets m ON m.id = om.market_id WHERE om.order_id = ? ORDER BY om.sequence`,
    )
    .bind(o.id)
    .all<{ id: string; sequence: number; status: string; ready_at: string | null; picked_at: string | null; courier_arrived_at: string | null; name: string; image_url: string | null; lat: number; lng: number }>();

  const active = !['entregue', 'cancelado'].includes(o.status);
  const cr = o.courier_id
    ? await db
        .prepare(
          `SELECT u.name, co.vehicle_type, co.vehicle_model, co.vehicle_color, co.vehicle_plate, co.lat, co.lng, co.last_seen_at
             FROM couriers co JOIN users u ON u.id = co.user_id WHERE co.id = ?`,
        )
        .bind(o.courier_id)
        .first<{ name: string; vehicle_type: string | null; vehicle_model: string | null; vehicle_color: string | null; vehicle_plate: string | null; lat: number | null; lng: number | null; last_seen_at: string | null }>()
    : null;

  const home = { lat: o.delivery_lat, lng: o.delivery_lng };
  const pending = stops.filter((s) => s.status !== 'retirado' && s.status !== 'entregue' && s.status !== 'cancelado');
  const hasPos = !!(active && cr && cr.lat != null && cr.lng != null);
  const from = hasPos ? { lat: cr!.lat!, lng: cr!.lng! } : null;
  const pts = [...(from ? [from] : []), ...pending, home];
  let remainingKm = 0;
  for (let i = 1; i < pts.length; i++) remainingKm += distanceKm(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
  let totalKm = 0;
  const all = [...stops, home];
  for (let i = 1; i < all.length; i++) totalKm += distanceKm(all[i - 1].lat, all[i - 1].lng, all[i].lat, all[i].lng);

  const nowMs = Date.now();
  const start = Date.parse(o.paid_at ?? o.created_at);
  const promisedMs = start + (o.eta_max_min ?? 60) * 60_000;
  let etaMin: number;
  if (!active) etaMin = 0;
  else if (from) etaMin = Math.round((remainingKm / SPEED_KMH) * 60) + PICKUP_MIN * pending.length;
  else etaMin = Math.max(5, Math.round((promisedMs - nowMs) / 60_000));
  const arrivalMs = nowMs + etaMin * 60_000;

  // Farol: verde (no prazo), amarelo (atrasando ou GPS instável), vermelho (atrasado ou sem sinal).
  const staleS = cr?.last_seen_at ? (nowMs - Date.parse(cr.last_seen_at)) / 1000 : null;
  const lateMin = (arrivalMs - promisedMs) / 60_000;
  let light: 'verde' | 'amarelo' | 'vermelho' = 'verde';
  let reason: string | null = null;
  if (active && o.status !== 'aguardando_pagamento') {
    if (lateMin > 10) [light, reason] = ['vermelho', 'atrasado'];
    else if (lateMin > 0) [light, reason] = ['amarelo', 'atrasando'];
    if (o.courier_id && o.status === 'em_rota' && staleS != null) {
      if (staleS > STALE_BAD_S) [light, reason] = ['vermelho', 'sem_sinal'];
      else if (staleS > STALE_WARN_S && light === 'verde') [light, reason] = ['amarelo', 'sinal_fraco'];
    }
  }

  return c.json({
    tracking: {
      id: o.id,
      status: o.status,
      courier_status: o.courier_status,
      cancel_reason: o.cancel_reason,
      // Código de entrega (só o cliente vê; some depois de entregue).
      delivery_code: active && o.status !== 'aguardando_pagamento' ? o.delivery_code : null,
      light,
      light_reason: reason,
      eta_min: etaMin,
      arrival_at: active ? new Date(arrivalMs).toISOString() : o.delivered_at,
      promised_at: new Date(promisedMs).toISOString(),
      total_km: Math.round(totalKm * 10) / 10,
      remaining_km: Math.round(remainingKm * 10) / 10,
      customer: home,
      stops: stops.map((s) => ({
        id: s.id,
        sequence: s.sequence,
        name: s.name,
        image_url: s.image_url,
        lat: s.lat,
        lng: s.lng,
        status: s.status,
        ready_at: s.ready_at,
        picked_at: s.picked_at,
        courier_here: !!s.courier_arrived_at && !s.picked_at,
      })),
      courier: cr
        ? {
            first_name: cr.name.split(' ')[0],
            vehicle: [cr.vehicle_type, cr.vehicle_model, cr.vehicle_color].filter(Boolean).join(' · '),
            plate: cr.vehicle_plate,
            // Posição só enquanto o pedido está em andamento.
            lat: hasPos ? cr.lat : null,
            lng: hasPos ? cr.lng : null,
            last_seen_at: hasPos ? cr.last_seen_at : null,
          }
        : null,
    },
  });
});

export default tracking;
