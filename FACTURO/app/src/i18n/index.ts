import { useSyncExternalStore } from 'react';
import { ptBR, type Dicionario } from './pt-BR';
import { en } from './en';
import { es } from './es';

export const IDIOMAS: Record<string, { nome: string; dic: Dicionario }> = {
  'pt-BR': { nome: 'Português', dic: ptBR },
  en: { nome: 'English', dic: en },
  es: { nome: 'Español', dic: es },
};

let atual = 'pt-BR';
let locale = 'pt-BR';
const ouvintes = new Set<() => void>();

export function idiomaDoAparelho(): string {
  const l = (navigator.language || 'en').toLowerCase();
  if (l.startsWith('pt')) return 'pt-BR';
  if (l.startsWith('es')) return 'es';
  return 'en';
}

/** Troca o idioma dos textos e o formato de números/datas (locale do país). */
export function definirIdioma(idioma: string, localeFormatacao?: string): void {
  atual = IDIOMAS[idioma] ? idioma : 'en';
  locale = localeFormatacao || atual;
  document.documentElement.lang = atual;
  ouvintes.forEach((o) => o());
}

export function idiomaAtual(): string {
  return atual;
}

function buscar(chave: string, dic: Dicionario): string | undefined {
  let v: unknown = dic;
  for (const parte of chave.split('.')) {
    if (v && typeof v === 'object') v = (v as Record<string, unknown>)[parte];
    else return undefined;
  }
  return typeof v === 'string' ? v : undefined;
}

/** t('doc.novo', { tipo: 'orçamento' }) → "Novo orçamento". Se faltar, cai no português. */
export function t(chave: string, vars?: Record<string, string | number>): string {
  const texto = buscar(chave, IDIOMAS[atual]!.dic) ?? buscar(chave, ptBR) ?? chave;
  return vars ? texto.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? '')) : texto;
}

export function dinheiro(centavos: number, moeda: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: moeda }).format(centavos / 100);
  } catch {
    return `${moeda} ${(centavos / 100).toFixed(2)}`;
  }
}

/** Recebe AAAA-MM-DD ou ISO e mostra no formato do país. */
export function data(valor: string | null | undefined): string {
  if (!valor) return '';
  const d = valor.length === 10 ? new Date(valor + 'T12:00:00') : new Date(valor);
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

/** Faz o componente redesenhar quando o idioma muda. */
export function useIdioma(): string {
  return useSyncExternalStore(
    (cb) => {
      ouvintes.add(cb);
      return () => ouvintes.delete(cb);
    },
    () => atual,
  );
}

/** Unidade cadastrada ("m2", "h"…) no idioma atual; texto livre fica como está. */
export function unidade(u: string): string {
  const r = t('unidades.' + u);
  return r === 'unidades.' + u ? u : r;
}
