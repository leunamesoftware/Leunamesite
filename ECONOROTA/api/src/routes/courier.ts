import { Hono, type Context } from 'hono';

import { audit, requireAuth } from '../lib/auth';
import { normalizeCpf } from '../lib/cpf';
import { newId, safeEqualText } from '../lib/crypto';
import { ApiError, badRequest, conflict, forbidden, notFound } from '../lib/errors';
import { readImage, streamFile } from '../lib/files';
import { distanceKm } from '../lib/geo';
import { balance, payoutsOf, settleDelivered, statement } from '../lib/ledger';
import { notifyAdmins, notifyCustomer, notifyOrderMarkets } from '../lib/notifications';
import { CAPACITY, COLD_CATEGORIES, fits, offeredTo, rankCouriers, type CourierPos } from '../lib/dispatch';
import { getSettings } from '../lib/settings';
import { seal, unsealRow } from '../lib/fieldCrypto';
import type { AppEnv, Env } from '../lib/types';
import { oneOf, readJson, str } from '../lib/validate';

/** Entregador (Fase 9): cadastro, documentos, disponibilidade, GPS e o fluxo completo da entrega. */
const courier = new Hono<AppEnv>();
courier.use('*', requireAuth('entregador'));

type Courier = {
  id: string; user_id: string; status: string; vehicle_type: string | null; vehicle_plate: string | null; vehicle_model: string | null;
  vehicle_color: string | null; cpf: string | null; birth_date: string | null; cnh_number: string | null; pix_key: string | null;
  vehicle_doc_key: string | null; document_photo_key: string | null; work_radius_km: number; submitted_at: string | null;
  review_note: string | null; is_online: number; lat: number | null; lng: number | null; last_seen_at: string | null;
  rating: number; rating_count: number;
};

const SPEED_KMH = 25;
const PICKUP_MIN = 5;
const PLATE = /^[A-Z]{3}-?\d[A-Z0-9]\d{2}$/; // ABC-1234 ou Mercosul ABC1D23
const now = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
const share = async (env: Env) => (await getSettings(env)).courier_share_pct;

async function me(c: Context<AppEnv>): Promise<Courier> {
  const raw = await c.env.DB.prepare('SELECT * FROM couriers WHERE user_id = ?').bind(c.get('user').id).first<Courier>();
  if (!raw) throw notFound('Cadastro de entregador não encontrado.');
  const row = await unsealRow(c.env, raw, ['cpf', 'cnh_number', 'pix_key']);
  return row;
}

async function approved(c: Context<AppEnv>) {
  const m = await me(c);
  if (m.status !== 'aprovado') throw forbidden(m.status === 'bloqueado' ? 'Cadastro bloqueado. Fale com o suporte.' : 'Seu cadastro ainda está em análise.');
  return m;
}

const missingFields = (m: Courier) => {
  const needsLicense = m.vehicle_type === 'moto' || m.vehicle_type === 'carro';
  return [
    !m.cpf && 'cpf',
    !m.birth_date && 'birth_date',
    !m.pix_key && 'pix_key',
    !m.vehicle_type && 'vehicle_type',
    needsLicense && !m.vehicle_plate && 'vehicle_plate',
    needsLicense && !m.cnh_number && 'cnh_number',
    !m.document_photo_key && 'document_photo',
    needsLicense && !m.vehicle_doc_key && 'vehicle_doc',
  ].filter(Boolean) as string[];
};

const profileView = (m: Courier) => ({
  status: m.status,
  in_review: m.status === 'pendente' && !!m.submitted_at,
  review_note: m.review_note,
  missing: missingFields(m),
  cpf: m.cpf ? `***.${m.cpf.slice(3, 6)}.${m.cpf.slice(6, 9)}-**` : null,
  birth_date: m.birth_date,
  cnh_number: m.cnh_number,
  pix_key: m.pix_key,
  vehicle_type: m.vehicle_type,
  vehicle_plate: m.vehicle_plate,
  vehicle_model: m.vehicle_model,
  vehicle_color: m.vehicle_color,
  has_document_photo: !!m.document_photo_key,
  has_vehicle_doc: !!m.vehicle_doc_key,
  work_radius_km: m.work_radius_km,
  is_online: m.is_online === 1,
  lat: m.lat,
  lng: m.lng,
  rating: m.rating ?? 0,
  rating_count: m.rating_count ?? 0,
});

courier.get('/perfil', async (c) => c.json({ courier: profileView(await me(c)) }));

/** Dados pessoais e do veículo (placa e CNH obrigatórias para moto e carro). */
courier.put('/perfil', async (c) => {
  const m = await me(c);
  const b = await readJson(c.req.raw);
  // Aprovado: só o raio de atuação continua editável (documentos e veículo passam pelo suporte).
  if (m.status === 'aprovado' && Object.keys(b).some((k) => k !== 'work_radius_km')) {
    throw conflict('Cadastro aprovado: para alterar dados, fale com o suporte.', 'locked');
  }
  const sets: Record<string, unknown> = {};
  if (b.cpf !== undefined) {
    const cpf = normalizeCpf(b.cpf);
    if (!cpf) throw badRequest('CPF inválido.', 'invalid_cpf');
    sets.cpf = cpf;
  }
  if (b.birth_date !== undefined) {
    const d = str(b, 'birth_date', { max: 10 })!;
    const age = /^\d{4}-\d{2}-\d{2}$/.test(d) ? (Date.now() - Date.parse(d)) / (365.25 * 86400_000) : NaN;
    if (!(age >= 18 && age < 90)) throw badRequest('É preciso ter 18 anos ou mais.', 'validation');
    sets.birth_date = d;
  }
  if (b.pix_key !== undefined) sets.pix_key = str(b, 'pix_key', { min: 5, max: 77 });
  if (b.vehicle_type !== undefined) sets.vehicle_type = oneOf(b, 'vehicle_type', ['moto', 'bicicleta', 'carro'] as const);
  if (b.vehicle_plate !== undefined) {
    const p = (str(b, 'vehicle_plate', { max: 8, optional: true }) ?? '').toUpperCase().replace(/\s/g, '');
    if (p && !PLATE.test(p)) throw badRequest('Placa inválida.', 'validation');
    sets.vehicle_plate = p || null;
  }
  if (b.cnh_number !== undefined) {
    const n = (str(b, 'cnh_number', { max: 11, optional: true }) ?? '').replace(/\D/g, '');
    if (n && n.length !== 11) throw badRequest('CNH inválida (11 números).', 'validation');
    sets.cnh_number = n || null;
  }
  if (b.vehicle_model !== undefined) sets.vehicle_model = str(b, 'vehicle_model', { max: 40, optional: true }) ?? null;
  if (b.vehicle_color !== undefined) sets.vehicle_color = str(b, 'vehicle_color', { max: 20, optional: true }) ?? null;
  if (b.work_radius_km !== undefined) {
    const r = Number(b.work_radius_km);
    if (!Number.isInteger(r) || r < 1 || r > 20) throw badRequest('Raio de 1 a 20 km.', 'validation');
    sets.work_radius_km = r;
  }
  const keys = Object.keys(sets);
  if (!keys.length) throw badRequest('Nada para alterar.', 'validation');
  for (const k of ['cpf', 'cnh_number', 'pix_key']) if (k in sets) sets[k] = await seal(c.env, sets[k] as string | null);
  await c.env.DB.prepare(`UPDATE couriers SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).bind(...keys.map((k) => sets[k]), m.id).run();
  return c.json({ courier: profileView(await me(c)) });
});

const FILE_COLS: Record<string, 'document_photo_key' | 'vehicle_doc_key'> = { documento: 'document_photo_key', crlv: 'vehicle_doc_key' };

/** Documento com foto (CNH/RG) ou documento do veículo (CRLV). Privados: só o entregador e a administração acessam. */
courier.put('/arquivos/:tipo', async (c) => {
  const m = await me(c);
  const col = FILE_COLS[c.req.param('tipo')];
  if (!col) throw notFound();
  if (m.status === 'aprovado') throw conflict('Cadastro aprovado: para trocar documentos, fale com o suporte.', 'locked');
  const { buf, type, ext } = await readImage(c);
  const key = `couriers/${m.id}/${c.req.param('tipo')}-${newId()}.${ext}`;
  await c.env.FILES.put(key, buf, { httpMetadata: { contentType: type } });
  const old = m[col];
  await c.env.DB.prepare(`UPDATE couriers SET ${col} = ? WHERE id = ?`).bind(key, m.id).run();
  if (old) await c.env.FILES.delete(old).catch(() => undefined);
  return c.json({ ok: true });
});

courier.get('/arquivos/:tipo', async (c) => {
  const m = await me(c);
  const col = FILE_COLS[c.req.param('tipo')];
  const key = col && m[col];
  const res = key ? await streamFile(c.env.FILES, key) : null;
  if (!res) throw notFound();
  return res;
});

/** Envia o cadastro para análise (em desenvolvimento é aprovado na hora). */
courier.post('/enviar', async (c) => {
  const m = await me(c);
  const missing = missingFields(m);
  if (missing.length) throw new ApiError(400, 'incomplete', `Complete o cadastro: ${missing.join(', ')}.`);
  if (m.status !== 'pendente') return c.json({ courier: profileView(m) });
  const auto = c.env.DEV_MODE === 'true';
  await c.env.DB.prepare(`UPDATE couriers SET submitted_at = ${now}, review_note = NULL ${auto ? ", status = 'aprovado'" : ''} WHERE id = ?`)
    .bind(m.id)
    .run();
  await audit(c.env.DB, { userId: c.get('user').id, action: 'courier.submit', entity: 'courier', entityId: m.id });
  if (!auto) {
    await notifyAdmins(c.env, {
      kind: 'entregador_analise',
      title: 'Novo cadastro de entregador',
      body: 'Um entregador enviou os documentos para análise.',
      link: `/admin/entregadores/${m.id}`,
    });
  }
  return c.json({ courier: profileView(await me(c)) });
});

function position(b: Record<string, unknown>) {
  const lat = Number(b.lat);
  const lng = Number(b.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw badRequest('Localização inválida.', 'validation');
  return { lat, lng };
}

/** Disponível / indisponível (precisa da localização para receber pedidos por perto). */
courier.post('/disponibilidade', async (c) => {
  const m = await approved(c);
  const b = await readJson(c.req.raw);
  if (typeof b.online !== 'boolean') throw badRequest('Valor inválido: online.', 'validation');
  if (!b.online) {
    const active = await c.env.DB.prepare(
      "SELECT 1 FROM orders WHERE courier_id = ? AND courier_status != 'entregue' AND status != 'cancelado'",
    )
      .bind(m.id)
      .first();
    if (active) throw conflict('Finalize a entrega em andamento antes de ficar indisponível.', 'active_delivery');
    await c.env.DB.prepare('UPDATE couriers SET is_online = 0 WHERE id = ?').bind(m.id).run();
    return c.json({ is_online: false });
  }
  const p = position(b);
  await c.env.DB.prepare(`UPDATE couriers SET is_online = 1, lat = ?, lng = ?, last_seen_at = ${now} WHERE id = ?`).bind(p.lat, p.lng, m.id).run();
  return c.json({ is_online: true });
});

/** GPS: posição atual (enviada pelo app a cada ~15 s enquanto disponível). */
courier.post('/localizacao', async (c) => {
  const m = await approved(c);
  const p = position(await readJson(c.req.raw));
  await c.env.DB.prepare(`UPDATE couriers SET lat = ?, lng = ?, last_seen_at = ${now} WHERE id = ?`).bind(p.lat, p.lng, m.id).run();
  return c.json({ ok: true });
});

type Stop = {
  id: string; market_id: string; sequence: number; status: string; name: string; address: string | null; district: string | null; lat: number; lng: number;
  cold_items: number;
};

async function stops(db: D1Database, orderIds: string[]) {
  if (!orderIds.length) return new Map<string, Stop[]>();
  const { results } = await db
    .prepare(
      `SELECT om.id, om.order_id, om.market_id, om.sequence, om.status, om.courier_arrived_at, om.picked_at,
              m.name, m.address, m.district, m.lat, m.lng,
              (SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_market_id = om.id AND COALESCE(oi.checked, 1) = 1) AS item_count,
              (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi JOIN products p ON p.id = oi.product_id
                WHERE oi.order_market_id = om.id AND COALESCE(oi.checked, 1) = 1 AND p.category_id IN (${[...COLD_CATEGORIES].map((x) => `'${x}'`).join(',')})) AS cold_items
         FROM order_markets om JOIN markets m ON m.id = om.market_id
        WHERE om.order_id IN (${orderIds.map(() => '?').join(',')}) ORDER BY om.sequence`,
    )
    .bind(...orderIds)
    .all<Stop & { order_id: string }>();
  const map = new Map<string, Stop[]>();
  for (const r of results) map.set(r.order_id, [...(map.get(r.order_id) ?? []), r]);
  return map;
}

/** Distância total (entregador → mercados na ordem → cliente) e tempo estimado. */
function routeOf(from: { lat: number; lng: number } | null, s: Stop[], to: { lat: number; lng: number }) {
  const pts = [...(from ? [from] : []), ...s, to];
  let km = 0;
  for (let i = 1; i < pts.length; i++) km += distanceKm(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
  return { km: Math.round(km * 10) / 10, minutes: Math.round((km / SPEED_KMH) * 60) + PICKUP_MIN * s.length };
}

type AvailableRow = {
  id: string; status: string; delivery_fee_cents: number; delivery_address: string; delivery_lat: number; delivery_lng: number; created_at: string;
  paid_at: string | null; weight_grams: number | null;
};

/** Entregadores disponíveis e sem entrega em andamento (para a prioridade dos pedidos). */
const freeCouriers = (db: D1Database) =>
  db
    .prepare(
      `SELECT co.id, co.lat, co.lng, co.rating, co.rating_count, co.vehicle_type, co.work_radius_km FROM couriers co
        WHERE co.status = 'aprovado' AND co.is_online = 1 AND co.lat IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.courier_id = co.id AND o.courier_status != 'entregue' AND o.status != 'cancelado')`,
    )
    .all<CourierPos>()
    .then((r) => r.results);

/** Pedidos disponíveis perto do entregador (endereço completo do cliente só depois de aceitar). */
courier.get('/pedidos-disponiveis', async (c) => {
  const m = await approved(c);
  if (!m.is_online) return c.json({ items: [], reason: 'offline' });
  if (m.lat == null || m.lng == null) return c.json({ items: [], reason: 'no_location' });
  const { results } = await c.env.DB.prepare(
    `SELECT id, status, delivery_fee_cents, delivery_address, delivery_lat, delivery_lng, created_at, paid_at, weight_grams FROM orders
      WHERE courier_id IS NULL AND status IN ('pago','em_separacao','pronto_coleta') ORDER BY created_at LIMIT 50`,
  ).all<AvailableRow>();
  const byOrder = await stops(c.env.DB, results.map((o) => o.id));
  const pct = await share(c.env);
  const pool = await freeCouriers(c.env.DB);
  const items = results
    .map((o) => {
      const s = byOrder.get(o.id) ?? [];
      const first = s[0];
      if (!first) return null;
      const toFirst = distanceKm(m.lat!, m.lng!, first.lat, first.lng);
      if (toFirst > m.work_radius_km || !fits(m.vehicle_type, o.weight_grams, s.length)) return null;
      if (!offeredTo(m.id, o.paid_at, rankCouriers(first, o.weight_grams, s.length, pool, distanceKm))) return null;
      const addr = JSON.parse(o.delivery_address ?? '{}') as { district?: string; city?: string };
      const r = routeOf({ lat: m.lat!, lng: m.lng! }, s, { lat: o.delivery_lat, lng: o.delivery_lng });
      return {
        id: o.id,
        status: o.status,
        distance_to_first_km: Math.round(toFirst * 10) / 10,
        route_km: r.km,
        minutes: r.minutes,
        earning_cents: Math.round((o.delivery_fee_cents * pct) / 100),
        weight_kg: o.weight_grams == null ? null : Math.round(o.weight_grams / 100) / 10,
        cold_items: s.reduce((n, x) => n + (x.cold_items ?? 0), 0),
        customer_district: [addr.district, addr.city].filter(Boolean).join(', '),
        markets: s.map((x) => ({ name: x.name, district: x.district, sequence: x.sequence, ready: x.status === 'pronto' })),
        created_at: o.created_at,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a!.distance_to_first_km - b!.distance_to_first_km);
  return c.json({ items });
});

/** Extrato: saldo disponível, a liberar, lançamentos e repasses. */
courier.get('/extrato', async (c) => {
  const m = await me(c);
  const db = c.env.DB;
  return c.json({ balance: await balance(db, 'entregador', m.id), entries: await statement(db, 'entregador', m.id), payouts: await payoutsOf(db, 'entregador', m.id) });
});

/** Aceita a entrega (um entregador por pedido; uma entrega por vez). */
courier.post('/pedidos/:id/aceitar', async (c) => {
  const m = await approved(c);
  if (!m.is_online) throw conflict('Fique disponível para aceitar entregas.', 'offline');
  const db = c.env.DB;
  const busy = await db.prepare("SELECT 1 FROM orders WHERE courier_id = ? AND courier_status != 'entregue' AND status != 'cancelado'").bind(m.id).first();
  if (busy) throw conflict('Você já tem uma entrega em andamento.', 'active_delivery');
  const o = await db.prepare('SELECT id, paid_at, weight_grams FROM orders WHERE id = ?').bind(c.req.param('id')).first<{ paid_at: string | null; weight_grams: number | null }>();
  if (!o) throw notFound('Pedido não encontrado.');
  const s = (await stops(db, [c.req.param('id')])).get(c.req.param('id')) ?? [];
  if (!fits(m.vehicle_type, o.weight_grams, s.length)) {
    const cap = CAPACITY[m.vehicle_type ?? 'moto'] ?? CAPACITY.moto;
    throw conflict(`Pedido acima da capacidade do seu veículo (até ${cap.maxKg} kg e ${cap.maxStops} mercados).`, 'capacity');
  }
  if (s[0] && !offeredTo(m.id, o.paid_at, rankCouriers(s[0], o.weight_grams, s.length, await freeCouriers(db), distanceKm))) {
    throw conflict('Este pedido está reservado para entregadores mais próximos. Tente em instantes.', 'reserved');
  }
  const res = await db
    .prepare(
      `UPDATE orders SET courier_id = ?, courier_status = 'aceito', courier_accepted_at = ${now}, updated_at = ${now}
        WHERE id = ? AND courier_id IS NULL AND status IN ('pago','em_separacao','pronto_coleta')`,
    )
    .bind(m.id, c.req.param('id'))
    .run();
  if (!res.meta.changes) throw conflict('Outro entregador já aceitou este pedido.', 'taken');
  await audit(db, { userId: c.get('user').id, action: 'delivery.accept', entity: 'order', entityId: c.req.param('id') });
  await notifyCustomer(c.env, c.req.param('id'), {
    kind: 'entregador',
    title: 'Entregador a caminho dos mercados',
    body: 'Um entregador aceitou seu pedido. Acompanhe no mapa.',
  });
  return c.json({ ok: true });
});

type Active = {
  id: string; status: string; courier_status: string; delivery_fee_cents: number; delivery_address: string; delivery_lat: number;
  delivery_lng: number; customer_name: string; customer_phone: string | null;
};

async function active(c: Context<AppEnv>, courierId: string, orderId?: string) {
  const o = await c.env.DB.prepare(
    `SELECT o.id, o.status, o.courier_status, o.delivery_fee_cents, o.delivery_address, o.delivery_lat, o.delivery_lng,
            u.name AS customer_name, u.phone AS customer_phone
       FROM orders o JOIN users u ON u.id = o.customer_user_id
      WHERE o.courier_id = ? AND o.courier_status != 'entregue' ${orderId ? 'AND o.id = ?' : "AND o.status != 'cancelado'"}
      ORDER BY o.courier_accepted_at DESC LIMIT 1`,
  )
    .bind(...(orderId ? [courierId, orderId] : [courierId]))
    .first<Active>();
  return o;
}

/** Entrega atual: paradas nos mercados (ordem da rota) e o cliente. */
courier.get('/entrega-atual', async (c) => {
  const m = await approved(c);
  const o = await active(c, m.id);
  if (!o) return c.json({ delivery: null });
  const s = (await stops(c.env.DB, [o.id])).get(o.id) ?? [];
  const addr = JSON.parse(o.delivery_address ?? '{}');
  const r = routeOf(m.lat != null && m.lng != null ? { lat: m.lat, lng: m.lng } : null, s.filter((x) => x.status !== 'retirado'), {
    lat: o.delivery_lat,
    lng: o.delivery_lng,
  });
  return c.json({
    delivery: {
      id: o.id,
      order_status: o.status,
      courier_status: o.courier_status,
      earning_cents: Math.round((o.delivery_fee_cents * (await share(c.env))) / 100),
      route_km: r.km,
      minutes: r.minutes,
      stops: s,
      customer: {
        first_name: o.customer_name.split(' ')[0],
        // Telefone só é exposto enquanto a entrega está ativa (para contato na porta).
        phone: o.customer_phone,
        address: addr,
        lat: o.delivery_lat,
        lng: o.delivery_lng,
      },
    },
  });
});

async function ownStop(c: Context<AppEnv>) {
  const m = await approved(c);
  const o = await active(c, m.id, c.req.param('id'));
  if (!o || o.status === 'cancelado') throw notFound('Entrega não encontrada.');
  const om = await c.env.DB.prepare('SELECT id, status, courier_arrived_at FROM order_markets WHERE id = ? AND order_id = ?')
    .bind(c.req.param('om'), o.id)
    .first<{ id: string; status: string; courier_arrived_at: string | null }>();
  if (!om) throw notFound('Mercado não encontrado neste pedido.');
  return { m, o, om };
}

/** Chegada ao mercado (o mercado vê que o entregador está no balcão). */
courier.post('/pedidos/:id/mercados/:om/chegada', async (c) => {
  const { o, om } = await ownStop(c);
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE order_markets SET courier_arrived_at = COALESCE(courier_arrived_at, ${now}) WHERE id = ?`).bind(om.id),
    c.env.DB.prepare(`UPDATE orders SET courier_status = 'no_mercado' WHERE id = ? AND courier_status IN ('aceito','no_mercado')`).bind(o.id),
  ]);
  return c.json({ ok: true, market_ready: om.status === 'pronto' });
});

/** Conferência + retirada: o entregador confirma a quantidade de itens recebida do mercado. */
courier.post('/pedidos/:id/mercados/:om/retirada', async (c) => {
  const { o, om } = await ownStop(c);
  if (om.status === 'retirado') return c.json({ ok: true });
  if (om.status !== 'pronto') throw conflict('O mercado ainda está separando este pedido. Aguarde o "pronto".', 'not_ready');
  const b = await readJson(c.req.raw);
  const db = c.env.DB;
  const exp = await db
    .prepare('SELECT COALESCE(SUM(quantity),0) AS n FROM order_items WHERE order_market_id = ? AND COALESCE(checked, 1) = 1')
    .bind(om.id)
    .first<{ n: number }>();
  if (Number(b.itens_conferidos) !== exp?.n) throw badRequest(`A quantidade não confere: o pedido tem ${exp?.n} itens. Confira com o mercado.`, 'count_mismatch');
  await db.batch([
    db.prepare(`UPDATE order_markets SET status = 'retirado', picked_at = ${now}, courier_arrived_at = COALESCE(courier_arrived_at, ${now}) WHERE id = ?`).bind(om.id),
    // Retirou em todos os mercados: segue para o cliente.
    db
      .prepare(
        `UPDATE orders SET status = 'em_rota', courier_status = 'a_caminho', updated_at = ${now}
          WHERE id = ? AND NOT EXISTS (SELECT 1 FROM order_markets WHERE order_id = ? AND status NOT IN ('retirado','cancelado'))`,
      )
      .bind(o.id, o.id),
  ]);
  const left = await db.prepare("SELECT COUNT(*) AS n FROM order_markets WHERE order_id = ? AND status NOT IN ('retirado','cancelado')").bind(o.id).first<{ n: number }>();
  if (!left?.n) {
    await notifyCustomer(c.env, o.id, {
      kind: 'em_rota',
      title: 'Seu pedido saiu para entrega',
      body: 'O entregador retirou tudo e está indo até você. Tenha o código de entrega em mãos.',
    });
  }
  return c.json({ ok: true, remaining_stops: left?.n ?? 0 });
});

/** Chegada ao cliente. */
courier.post('/pedidos/:id/chegada-cliente', async (c) => {
  const m = await approved(c);
  const o = await active(c, m.id, c.req.param('id'));
  if (!o || o.status !== 'em_rota') throw conflict('Retire o pedido em todos os mercados antes.', 'invalid_state');
  await c.env.DB.prepare(`UPDATE orders SET courier_status = 'chegou', courier_arrived_at = ${now} WHERE id = ?`).bind(o.id).run();
  await notifyCustomer(c.env, o.id, {
    kind: 'chegou',
    title: 'O entregador chegou!',
    body: 'Mostre o QR Code ou informe o código de entrega de 6 dígitos.',
  });
  return c.json({ ok: true });
});

/** Entrega: confirmada com o código do cliente (QR Code ou 6 dígitos). Após 5 erros, só com o suporte. */
courier.post('/pedidos/:id/entregar', async (c) => {
  const m = await approved(c);
  const db = c.env.DB;
  const o = await db
    .prepare('SELECT id, status, courier_status, delivery_code, delivery_attempts, delivery_fee_cents FROM orders WHERE id = ? AND courier_id = ?')
    .bind(c.req.param('id'), m.id)
    .first<{ id: string; status: string; courier_status: string; delivery_code: string; delivery_attempts: number; delivery_fee_cents: number }>();
  if (!o) throw notFound('Entrega não encontrada.');
  if (o.courier_status === 'entregue') return c.json({ ok: true });
  if (o.status !== 'em_rota') throw conflict('Retire o pedido em todos os mercados antes.', 'invalid_state');
  if (o.delivery_attempts >= 5) throw new ApiError(429, 'too_many_attempts', 'Muitas tentativas. Fale com o suporte para concluir a entrega.');
  const code = String((await readJson(c.req.raw)).codigo ?? '').replace(/\D/g, '');
  if (!o.delivery_code || code.length !== 6 || !safeEqualText(code, o.delivery_code)) {
    await db.prepare('UPDATE orders SET delivery_attempts = delivery_attempts + 1 WHERE id = ?').bind(o.id).run();
    throw badRequest(`Código incorreto. Restam ${4 - o.delivery_attempts} tentativas.`, 'wrong_code');
  }
  const earning = Math.round((o.delivery_fee_cents * (await share(c.env))) / 100);
  await db.batch([
    db
      .prepare(
        `UPDATE orders SET status = 'entregue', courier_status = 'entregue', delivered_at = ${now}, courier_earning_cents = ?, updated_at = ${now} WHERE id = ?`,
      )
      .bind(earning, o.id),
    db.prepare("UPDATE order_markets SET status = 'entregue' WHERE order_id = ? AND status = 'retirado'").bind(o.id),
  ]);
  await settleDelivered(c.env, o.id);
  await notifyCustomer(c.env, o.id, {
    kind: 'entregue',
    title: 'Pedido entregue. Bom proveito!',
    body: 'Conte como foi: avalie o mercado e o entregador.',
    link: `/avaliar/${o.id}`,
    email: true,
  });
  await notifyOrderMarkets(c.env, o.id, () => ({ kind: 'entregue', title: 'Pedido entregue', body: 'O cliente recebeu o pedido.' }));
  await audit(db, { userId: c.get('user').id, action: 'delivery.done', entity: 'order', entityId: o.id });
  return c.json({ ok: true, earning_cents: earning });
});

/** Ganhos por período (entregas finalizadas). */
courier.get('/ganhos', async (c) => {
  const m = await me(c);
  const days = c.req.query('dias') === '30' ? 30 : 7;
  const { results } = await c.env.DB.prepare(
    `SELECT date(delivered_at, '-3 hours') AS day, COUNT(*) AS deliveries, SUM(courier_earning_cents) AS earning_cents
       FROM orders WHERE courier_id = ? AND status = 'entregue' AND delivered_at >= datetime('now', ?)
      GROUP BY day ORDER BY day DESC`,
  )
    .bind(m.id, `-${days} days`)
    .all<{ day: string; deliveries: number; earning_cents: number }>();
  return c.json({
    days,
    deliveries: results.reduce((s, r) => s + r.deliveries, 0),
    earning_cents: results.reduce((s, r) => s + r.earning_cents, 0),
    by_day: results,
  });
});

/** Histórico de entregas. */
courier.get('/historico', async (c) => {
  const m = await me(c);
  const { results } = await c.env.DB.prepare(
    `SELECT o.id, o.status, o.courier_earning_cents AS earning_cents, o.delivered_at, o.courier_accepted_at,
            (SELECT COUNT(*) FROM order_markets om WHERE om.order_id = o.id) AS market_count,
            (SELECT GROUP_CONCAT(mk.name, ', ') FROM order_markets om JOIN markets mk ON mk.id = om.market_id WHERE om.order_id = o.id) AS markets
       FROM orders o WHERE o.courier_id = ? AND (o.status IN ('entregue','cancelado'))
      ORDER BY COALESCE(o.delivered_at, o.updated_at) DESC LIMIT 100`,
  )
    .bind(m.id)
    .all();
  return c.json({ items: results });
});

export default courier;
