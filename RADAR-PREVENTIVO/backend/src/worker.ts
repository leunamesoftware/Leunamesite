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
  DOWNLOADS: { get(chave: string): Promise<{ body: ReadableStream; size: number; uploaded: Date } | null> };
  ASSETS: { fetch(requisicao: Request): Promise<Response> };
  /** Servidor de contas da loja LeuApps (ligação interna da Cloudflare). */
  CONTAS?: { fetch(requisicao: Request): Promise<Response> };
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
    // Confere no servidor de contas da loja quem está logado (o cookie da loja vale em *.leunamesoftware.com.br).
    contaLeuApps: async (cookie) => {
      if (!env.CONTAS || !cookie) return null;
      const r = await env.CONTAS.fetch(new Request('https://www.leunamesoftware.com.br/api/conta', { headers: { Cookie: cookie } }));
      if (!r.ok) return null;
      const d = (await r.json().catch(() => null)) as { conta?: { nome?: string; email?: string } | null } | null;
      return d?.conta?.email ? { nome: String(d.conta.nome || d.conta.email.split('@')[0]), email: String(d.conta.email) } : null;
    },
  };
}

/** Instalador Android para instalar direto no celular (sem passar pela Play Store). */
async function baixarApk(env: Env): Promise<Response> {
  const arquivo = await env.DOWNLOADS.get('RadarPreventivo.apk');
  if (!arquivo) return new Response('O instalador ainda não foi publicado.', { status: 404 });
  return new Response(arquivo.body, {
    headers: {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': 'attachment; filename="RadarPreventivo.apk"',
      'Content-Length': String(arquivo.size),
      'Cache-Control': 'no-cache',
      'Last-Modified': arquivo.uploaded.toUTCString(),
    },
  });
}

export default {
  async fetch(requisicao: Request, env: Env): Promise<Response> {
    const url = new URL(requisicao.url);
    if (url.pathname.startsWith('/api/') || url.pathname === '/api') {
      return criarApp(dependencias(env)).fetch(requisicao);
    }
    if (url.pathname === '/baixar/RadarPreventivo.apk') return baixarApk(env);
    if (url.pathname.startsWith('/baixar/')) return new Response('Arquivo não encontrado.', { status: 404 });
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
