import { paginaDocumento, paginaSimples, type Aprovacao } from './pagina';
import { textos } from './textos';
import { assinaturaValida, chaveAleatoria, CORS, iguais, idAleatorio, json, sha256, somarDias, validarCopia } from './util';

export interface Env { DB: D1Database }

const VALIDADE_DIAS = 120;
const LINKS_POR_HORA = 30;
const MAX_CORPO = 600_000;
const ID = /^[A-Za-z0-9]{16}$/;

interface Linha {
  id: string; chave_hash: string; dados: string; expira_em: string; visto_em: string | null; aprovacao: string | null; recusado: number; pago_informado_em: string | null;
}

async function lerCorpo(req: Request): Promise<unknown> {
  const tam = Number(req.headers.get('Content-Length') ?? 0);
  if (tam > MAX_CORPO) return null;
  const texto = await req.text();
  if (texto.length > MAX_CORPO) return null;
  try { return JSON.parse(texto); } catch { return null; }
}

async function buscar(env: Env, id: string): Promise<Linha | null> {
  if (!ID.test(id)) return null;
  const l = await env.DB.prepare('SELECT * FROM links WHERE id = ?').bind(id).first<Linha>();
  return l && l.expira_em > new Date().toISOString() ? l : null;
}

async function doDono(req: Request, env: Env, id: string): Promise<Linha | null> {
  const chave = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!/^[0-9a-f]{64}$/.test(chave)) return null;
  const l = await buscar(env, id);
  return l && iguais(l.chave_hash, await sha256(chave)) ? l : null;
}

/** Página "link vencido" no idioma do navegador. */
function naoEncontrado(req: Request): Response {
  const al = (req.headers.get('Accept-Language') ?? '').toLowerCase();
  const idioma = al.startsWith('pt') ? 'pt-BR' : al.startsWith('es') ? 'es' : 'en';
  return html(paginaSimples(textos(idioma).vencido, idioma), 404);
}

const ipHash = (req: Request) => sha256('facturo:' + (req.headers.get('CF-Connecting-IP') ?? ''));

function html(corpo: string, status = 200, nonce = ''): Response {
  return new Response(corpo, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': `default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'`,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

/** POSTs da página só podem vir da própria página (evita envio forjado por outro site). */
function mesmaOrigem(req: Request): boolean {
  const o = req.headers.get('Origin');
  return !o || o === new URL(req.url).origin;
}

async function criar(req: Request, env: Env): Promise<Response> {
  const copia = validarCopia(await lerCorpo(req));
  if (!copia) return json({ erro: 'dados_invalidos' }, 400);
  const ip = await ipHash(req);
  const umaHora = new Date(Date.now() - 3_600_000).toISOString();
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM links WHERE ip_hash = ? AND criado_em > ?').bind(ip, umaHora).first<{ n: number }>();
  if ((n?.n ?? 0) >= LINKS_POR_HORA) return json({ erro: 'limite' }, 429, { 'Retry-After': '3600' });

  const id = idAleatorio(16);
  const chaveDono = chaveAleatoria();
  const agora = new Date().toISOString();
  await env.DB.prepare('INSERT INTO links (id, chave_hash, dados, criado_em, atualizado_em, expira_em, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, await sha256(chaveDono), JSON.stringify(copia), agora, agora, somarDias(VALIDADE_DIAS), ip).run();
  return json({ id, chaveDono, url: `https://${new URL(req.url).host}/o/${id}` }, 201);
}

async function atualizar(req: Request, env: Env, id: string): Promise<Response> {
  const l = await doDono(req, env, id);
  if (!l) return json({ erro: 'nao_encontrado' }, 404);
  const copia = validarCopia(await lerCorpo(req));
  if (!copia) return json({ erro: 'dados_invalidos' }, 400);
  await env.DB.prepare('UPDATE links SET dados = ?, atualizado_em = ?, expira_em = ? WHERE id = ?')
    .bind(JSON.stringify(copia), new Date().toISOString(), somarDias(VALIDADE_DIAS), id).run();
  return json({ ok: true });
}

async function situacao(req: Request, env: Env, id: string): Promise<Response> {
  const l = await doDono(req, env, id);
  if (!l) return json({ erro: 'nao_encontrado' }, 404);
  return json({ aprovacao: l.aprovacao ? JSON.parse(l.aprovacao) : null, recusado: l.recusado === 1, vistoEm: l.visto_em, pagoInformadoEm: l.pago_informado_em });
}

async function pagina(req: Request, env: Env, id: string, ctx: ExecutionContext): Promise<Response> {
  const l = await buscar(env, id);
  if (!l) return naoEncontrado(req);
  const dados = JSON.parse(l.dados);
  if (!l.visto_em) ctx.waitUntil(env.DB.prepare('UPDATE links SET visto_em = ? WHERE id = ?').bind(new Date().toISOString(), id).run());
  const nonce = chaveAleatoria().slice(0, 24);
  const aprovacao = l.aprovacao ? (JSON.parse(l.aprovacao) as Aprovacao) : null;
  return html(await paginaDocumento(id, dados, aprovacao, l.recusado === 1, nonce, l.pago_informado_em), 200, nonce);
}

async function informarPagamento(req: Request, env: Env, id: string): Promise<Response> {
  if (!mesmaOrigem(req)) return json({ erro: 'origem' }, 403);
  const l = await buscar(env, id);
  if (!l) return json({ erro: 'nao_encontrado' }, 404);
  if (JSON.parse(l.dados).tipo !== 'fatura') return json({ erro: 'nao_e_fatura' }, 409);
  await env.DB.prepare('UPDATE links SET pago_informado_em = ? WHERE id = ? AND pago_informado_em IS NULL').bind(new Date().toISOString(), id).run();
  return json({ ok: true });
}

async function responder(req: Request, env: Env, id: string, acao: 'aprovar' | 'recusar'): Promise<Response> {
  if (!mesmaOrigem(req)) return json({ erro: 'origem' }, 403);
  const l = await buscar(env, id);
  if (!l) return json({ erro: 'nao_encontrado' }, 404);
  if (!JSON.parse(l.dados).pedeAprovacao || l.aprovacao) return json({ erro: 'ja_respondido' }, 409);

  if (acao === 'recusar') {
    await env.DB.prepare('UPDATE links SET recusado = 1 WHERE id = ? AND aprovacao IS NULL').bind(id).run();
    return json({ ok: true });
  }
  const corpo = (await lerCorpo(req)) as Record<string, unknown> | null;
  const nome = typeof corpo?.nome === 'string' ? corpo.nome.trim().slice(0, 120) : '';
  const assinatura = assinaturaValida(corpo?.assinatura);
  if (!nome || !assinatura) return json({ erro: 'dados_invalidos' }, 400);
  const aprovacao: Aprovacao = { nome, assinatura, em: new Date().toISOString() };
  // "aprovacao IS NULL" garante uma única aprovação mesmo com dois envios simultâneos.
  const r = await env.DB.prepare('UPDATE links SET aprovacao = ?, recusado = 0 WHERE id = ? AND aprovacao IS NULL').bind(JSON.stringify(aprovacao), id).run();
  return r.meta.changes ? json({ ok: true }) : json({ erro: 'ja_respondido' }, 409);
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(req.url);
    const m = req.method;
    try {
      if (m === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
      if (pathname === '/api/links' && m === 'POST') return await criar(req, env);
      let r = pathname.match(/^\/api\/links\/([^/]+)$/);
      if (r && m === 'PUT') return await atualizar(req, env, r[1]!);
      r = pathname.match(/^\/api\/links\/([^/]+)\/status$/);
      if (r && m === 'GET') return await situacao(req, env, r[1]!);
      r = pathname.match(/^\/o\/([^/]+)$/);
      if (r && m === 'GET') return await pagina(req, env, r[1]!, ctx);
      r = pathname.match(/^\/o\/([^/]+)\/(aprovar|recusar)$/);
      if (r && m === 'POST') return await responder(req, env, r[1]!, r[2] as 'aprovar' | 'recusar');
      r = pathname.match(/^\/o\/([^/]+)\/paguei$/);
      if (r && m === 'POST') return await informarPagamento(req, env, r[1]!);
      if (pathname === '/' && m === 'GET') return Response.redirect('https://leunamesoftware.com.br/', 302);
      if (pathname === '/saude') return json({ ok: true });
      return pathname.startsWith('/api/') ? json({ erro: 'nao_encontrado' }, 404) : naoEncontrado(req);
    } catch (e) {
      console.error('erro', pathname, e);
      return json({ erro: 'interno' }, 500);
    }
  },

  async scheduled(_c: ScheduledController, env: Env): Promise<void> {
    await env.DB.prepare('DELETE FROM links WHERE expira_em < ?').bind(new Date().toISOString()).run();
  },
};
