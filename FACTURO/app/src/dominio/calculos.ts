import type { Documento, LinhaDocumento, TipoDocumento } from './tipos';

export function totalLinha(l: LinhaDocumento): number {
  return Math.round(l.quantidade * l.precoUnitario);
}

export function subtotal(linhas: LinhaDocumento[]): number {
  return linhas.reduce((s, l) => s + totalLinha(l), 0);
}

export function total(doc: Pick<Documento, 'linhas' | 'desconto'>): number {
  return Math.max(0, subtotal(doc.linhas) - Math.max(0, doc.desconto));
}

/** Converte texto digitado ("1.234,56", "1,234.56", "150") em centavos. */
export function paraCentavos(texto: string): number {
  const limpo = texto.replace(/[^\d.,-]/g, '');
  if (!limpo) return 0;
  const ultimoSep = Math.max(limpo.lastIndexOf(','), limpo.lastIndexOf('.'));
  let inteiro = limpo;
  let decimal = '';
  if (ultimoSep >= 0 && limpo.length - ultimoSep - 1 <= 2) {
    inteiro = limpo.slice(0, ultimoSep);
    decimal = limpo.slice(ultimoSep + 1);
  }
  const n = Number(inteiro.replace(/[.,]/g, '') || '0');
  const d = Number((decimal + '00').slice(0, 2));
  return Math.round(n * 100 + d);
}

/** Hoje (ou a data base) somado a N dias, no formato AAAA-MM-DD. */
export function somarDias(dias: number, base = new Date()): string {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + dias);
  return dataLocal(d);
}

export function dataLocal(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Fatura em aberto com vencimento no passado. */
export function estaVencida(doc: Documento, hoje = dataLocal()): boolean {
  return doc.tipo === 'fatura' && doc.status !== 'pago' && doc.status !== 'cancelado' && !!doc.venceEm && doc.venceEm < hoje;
}

const PREFIXO: Record<TipoDocumento, string> = { orcamento: 'ORC', fatura: 'FAT', recibo: 'REC' };

export function codigo(doc: Pick<Documento, 'tipo' | 'numero'>): string {
  return `${PREFIXO[doc.tipo]}-${String(doc.numero).padStart(4, '0')}`;
}
