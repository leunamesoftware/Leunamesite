/**
 * Operação de entrega (Fase 14): peso estimado do pedido, capacidade de cada veículo, perecíveis e seleção de entregador.
 *
 * Peso estimado e capacidade.
 * O peso vem da unidade do produto ("5 kg", "900 ml", "1 un", "dz"); sem unidade clara, usa uma média conservadora.
 */
const UNIT = /(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|un|und|unid|dz|d[uú]zia)\b/i;
const DEFAULT_GRAMS = 500;

export function unitGrams(unit: string | null | undefined): number {
  const m = UNIT.exec((unit ?? '').toLowerCase());
  if (!m) return DEFAULT_GRAMS;
  const n = Number(m[1].replace(',', '.'));
  switch (m[2]) {
    case 'kg':
    case 'l':
      return Math.round(n * 1000);
    case 'g':
    case 'ml':
      return Math.round(n);
    case 'dz':
    case 'duzia':
    case 'dúzia':
      return Math.round(n * 700);
    default:
      return Math.round(n * DEFAULT_GRAMS);
  }
}

export const orderGrams = (lines: { unit?: string | null; qty: number }[]) => lines.reduce((s, l) => s + unitGrams(l.unit) * l.qty, 0);

/** Capacidade por veículo: peso máximo e número de coletas. */
export const CAPACITY: Record<string, { maxKg: number; maxStops: number }> = {
  bicicleta: { maxKg: 12, maxStops: 2 },
  moto: { maxKg: 25, maxStops: 3 },
  carro: { maxKg: 150, maxStops: 3 },
};

export function fits(vehicle: string | null | undefined, grams: number | null | undefined, stops: number) {
  const cap = CAPACITY[vehicle ?? ''] ?? CAPACITY.moto;
  return (grams ?? 0) <= cap.maxKg * 1000 && stops <= cap.maxStops;
}

/** Categorias que precisam de refrigeração (coleta por último e bolsa térmica). */
export const COLD_CATEGORIES = new Set(['carnes', 'laticinios', 'congelados', 'frios']);

/**
 * Seleção de entregador: nos primeiros PRIORITY_SECONDS depois do pagamento, o pedido aparece só para os
 * PRIORITY_TOP melhores entregadores disponíveis (perto do 1º mercado, bem avaliados e com veículo adequado ao peso).
 * Depois disso, fica aberto a todos os que atendem a região e têm veículo compatível.
 */

export const PRIORITY_SECONDS = 90;
export const PRIORITY_TOP = 3;
/** Nota usada para quem ainda tem poucas avaliações (não penaliza novatos). */
const NEUTRAL_RATING = 4.5;
const MIN_RATINGS = 5;
/** Cada estrela abaixo de 5 "vale" 2 km a mais de distância. */
const KM_PER_STAR = 2;

export type CourierPos = {
  id: string; lat: number | null; lng: number | null; rating: number; rating_count: number; vehicle_type: string | null; work_radius_km: number;
};

type Dist = (lat1: number, lng1: number, lat2: number, lng2: number) => number;

export function rankCouriers(first: { lat: number; lng: number }, grams: number | null, stopCount: number, couriers: CourierPos[], dist: Dist) {
  return couriers
    .map((c) => {
      if (c.lat == null || c.lng == null || !fits(c.vehicle_type, grams, stopCount)) return null;
      const km = dist(c.lat, c.lng, first.lat, first.lng);
      if (km > c.work_radius_km) return null;
      const rating = c.rating_count >= MIN_RATINGS ? c.rating : NEUTRAL_RATING;
      return { id: c.id, km, score: km + (5 - rating) * KM_PER_STAR };
    })
    .filter((x): x is { id: string; km: number; score: number } => x !== null)
    .sort((a, b) => a.score - b.score);
}

/** Este entregador pode ver/aceitar o pedido agora? */
export function offeredTo(courierId: string, paidAt: string | null, ranked: { id: string }[], now = Date.now()) {
  if (!paidAt || now - Date.parse(paidAt) >= PRIORITY_SECONDS * 1000) return true;
  return ranked.slice(0, PRIORITY_TOP).some((r) => r.id === courierId);
}
