/** Configurações da plataforma: tabela `settings` (editável no painel) → variável do wrangler.toml → padrão. */
import type { Env } from './types';

export type Settings = {
  /** Pedido mínimo do EconoRota (soma dos mercados), em centavos. */
  min_order_cents: number;
  /** Comissão sobre as vendas do mercado, em %. */
  commission_pct: number;
  /** Parte da taxa de entrega que fica com o entregador, em %. */
  courier_share_pct: number;
  /** Entrega única: valor para 1 mercado e adicional por mercado extra, em centavos. */
  delivery_base_cents: number;
  delivery_extra_market_cents: number;
  /** Dias após a entrega para liberar o valor do mercado (prazo de reclamação de produto). */
  market_hold_days: number;
};

type Rule = { env?: keyof Env; def: number; min: number; max: number };

export const RULES: Record<keyof Settings, Rule> = {
  min_order_cents: { env: 'MIN_ORDER_CENTS', def: 10000, min: 0, max: 100000 },
  commission_pct: { env: 'COMMISSION_PCT', def: 10, min: 0, max: 50 },
  courier_share_pct: { env: 'COURIER_SHARE_PCT', def: 80, min: 0, max: 100 },
  delivery_base_cents: { def: 790, min: 0, max: 5000 },
  delivery_extra_market_cents: { def: 300, min: 0, max: 5000 },
  market_hold_days: { def: 2, min: 0, max: 30 },
};

let cache: { at: number; db: D1Database; value: Settings } | null = null;
const TTL_MS = 30_000;

export function clearSettingsCache() {
  cache = null;
}

export async function getSettings(env: Env): Promise<Settings> {
  if (cache && cache.db === env.DB && Date.now() - cache.at < TTL_MS) return cache.value;
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>();
  const stored = new Map(results.map((r) => [r.key, Number(r.value)]));
  const value = {} as Settings;
  for (const [key, rule] of Object.entries(RULES) as [keyof Settings, Rule][]) {
    const fromEnv = rule.env ? Number(env[rule.env] as string | undefined) : NaN;
    const v = stored.get(key) ?? (Number.isFinite(fromEnv) && env[rule.env!] !== undefined ? fromEnv : rule.def);
    value[key] = Math.min(Math.max(Number.isFinite(v) ? v : rule.def, rule.min), rule.max);
  }
  cache = { at: Date.now(), db: env.DB, value };
  return value;
}
