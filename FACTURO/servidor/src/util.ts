const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/** Texto aleatório e impossível de adivinhar (16 caracteres ≈ 92 bits). */
export function idAleatorio(tamanho = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(tamanho));
  let s = '';
  for (const b of bytes) s += ALFABETO[b % ALFABETO.length];
  return s;
}

export function chaveAleatoria(): string {
  return [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256(texto: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Compara sem vazar tempo (evita adivinhação por medição de tempo). */
export function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function json(dados: unknown, status = 200, extra: HeadersInit = {}): Response {
  return new Response(JSON.stringify(dados), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS, ...extra } });
}

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export function somarDias(dias: number): string {
  return new Date(Date.now() + dias * 86_400_000).toISOString();
}

const s = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const imagem = (v: unknown, max: number): string | null =>
  typeof v === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= max ? v : null;
const url = (v: unknown): string => {
  const u = s(v, 500).trim();
  return /^https:\/\/[^\s<>"']+$/i.test(u) ? u : '';
};
const data = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

export interface CopiaPublica {
  v: 1;
  idioma: string;
  locale: string;
  tipo: 'orcamento' | 'fatura';
  codigo: string;
  moeda: string;
  emitidoEm: string | null;
  validoAte: string | null;
  venceEm: string | null;
  negocio: { nome: string; documento: string; telefone: string; email: string; endereco: string; logo: string | null; cor: string };
  cliente: { nome: string };
  linhas: { nome: string; unidade: string; quantidade: number; precoUnitario: number }[];
  subtotal: number;
  desconto: number;
  total: number;
  observacoes: string;
  pagamento: { pix: string; link: string; banco: string } | null;
  pedeAprovacao: boolean;
}

/** Aceita só o formato esperado e corta tamanhos: nada do que vem do app vira HTML sem passar por aqui. */
export function validarCopia(entrada: unknown): CopiaPublica | null {
  if (!entrada || typeof entrada !== 'object') return null;
  const e = entrada as Record<string, any>;
  if (e.tipo !== 'orcamento' && e.tipo !== 'fatura') return null;
  if (!Array.isArray(e.linhas) || e.linhas.length === 0 || e.linhas.length > 200) return null;
  const moeda = s(e.moeda, 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(moeda)) return null;
  const neg = (e.negocio ?? {}) as Record<string, unknown>;
  const pag = e.pagamento as Record<string, unknown> | null;
  return {
    v: 1,
    idioma: ['pt-BR', 'en', 'es'].includes(e.idioma) ? e.idioma : 'en',
    locale: /^[a-z]{2}(-[A-Z]{2})?$/.test(e.locale) ? e.locale : 'en-US',
    tipo: e.tipo,
    codigo: s(e.codigo, 20),
    moeda,
    emitidoEm: data(e.emitidoEm),
    validoAte: data(e.validoAte),
    venceEm: data(e.venceEm),
    negocio: {
      nome: s(neg.nome, 120), documento: s(neg.documento, 60), telefone: s(neg.telefone, 40), email: s(neg.email, 120),
      endereco: s(neg.endereco, 200), logo: imagem(neg.logo, 400_000), cor: /^#[0-9a-fA-F]{6}$/.test(String(neg.cor)) ? String(neg.cor) : '#0E9F6E',
    },
    cliente: { nome: s(e.cliente?.nome, 120) },
    linhas: e.linhas.map((l: Record<string, unknown>) => ({ nome: s(l.nome, 200), unidade: s(l.unidade, 20), quantidade: n(l.quantidade), precoUnitario: Math.round(n(l.precoUnitario)) })),
    subtotal: Math.round(n(e.subtotal)),
    desconto: Math.round(n(e.desconto)),
    total: Math.round(n(e.total)),
    observacoes: s(e.observacoes, 2000),
    pagamento: pag ? { pix: s(pag.pix, 600), link: url(pag.link), banco: s(pag.banco, 600) } : null,
    pedeAprovacao: e.tipo === 'orcamento',
  };
}

export function assinaturaValida(v: unknown): string | null {
  return imagem(v, 200_000);
}
