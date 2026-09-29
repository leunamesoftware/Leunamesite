import { criarApp } from './app.js';
import type { Dependencias } from './comum/ambiente.js';
import { relogioDoSistema } from './comum/tempo.js';
import { carregarConfig } from './config.js';
import { criarArmazenamentoR2, type R2Bucket } from './infra/armazenamento/r2.js';
import { criarBancoD1, type D1Database } from './infra/banco/d1.js';
import { canalApp } from './modulos/alertas/canais.js';
import { executarRotina } from './modulos/rotina/servico.js';

// Entrada do Radar Preventivo na Cloudflare Workers.
// - /api/* → API (Hono), com banco D1 e anexos no R2.
// - demais endereços → aplicativo (arquivos estáticos do frontend, via ASSETS).
// - agendamento diário (cron) → rotina que reanalisa os itens e gera alertas.

interface Env {
  BANCO: D1Database;
  ANEXOS: R2Bucket;
  ASSETS: { fetch(requisicao: Request): Promise<Response> };
  [variavel: string]: unknown;
}

function dependencias(env: Env): Dependencias {
  const variaveis = Object.fromEntries(Object.entries(env).filter(([, v]) => typeof v === 'string')) as Record<string, string>;
  return {
    banco: criarBancoD1(env.BANCO),
    armazenamento: criarArmazenamentoR2(env.ANEXOS),
    config: carregarConfig(variaveis),
    relogio: relogioDoSistema,
    canaisAlerta: [canalApp],
  };
}

export default {
  async fetch(requisicao: Request, env: Env): Promise<Response> {
    const url = new URL(requisicao.url);
    if (url.pathname.startsWith('/api/') || url.pathname === '/api') {
      return criarApp(dependencias(env)).fetch(requisicao);
    }
    return env.ASSETS.fetch(requisicao);
  },

  async scheduled(_evento: unknown, env: Env, contexto: { waitUntil(p: Promise<unknown>): void }): Promise<void> {
    contexto.waitUntil(
      executarRotina(dependencias(env)).then((r) =>
        console.log(`[rotina] ${r.data}: ${r.itensAnalisados} itens, ${r.alertasCriados} alertas, ${r.falhas} falhas`),
      ),
    );
  },
};
