import type { ItemResumo, Situacao } from '@compartilhado/contratos';

// Como cada situação aparece na tela: cor, nome e textos de prazo.

export type Tom = 'vermelho' | 'laranja' | 'amarelo' | 'verde' | 'azul' | 'roxo';

export const TOM_DA_SITUACAO: Record<Situacao, Tom> = {
  vencido: 'vermelho',
  vence_hoje: 'laranja',
  urgente: 'laranja',
  atencao: 'amarelo',
  em_dia: 'azul',
  sem_prazo: 'roxo',
};

export const NOME_DA_SITUACAO: Record<Situacao, string> = {
  vencido: 'Vencido',
  vence_hoje: 'Vence hoje',
  urgente: 'Urgente',
  atencao: 'Atenção',
  em_dia: 'A vencer',
  sem_prazo: 'Sem data',
};

/** "2026-10-05" → "05/10/2026" (sem passar por fuso horário). */
export function dataBr(data: string): string {
  const [a, m, d] = data.split('-');
  return `${d}/${m}/${a}`;
}

function emDias(n: number): string {
  return n === 1 ? '1 dia' : `${n} dias`;
}

export function situacaoDe(item: ItemResumo): Situacao {
  return item.analise?.situacao ?? 'sem_prazo';
}

/** Linha de apoio do painel: "Venceu em 15/09/2026", "Vence em 5 dias", "Vence em 28/10/2026". */
export function textoPrazo(item: ItemResumo): string {
  const s = situacaoDe(item);
  const dias = item.analise?.diasRestantes ?? null;
  if (!item.dataVencimento) return 'Sem data de vencimento';
  if (s === 'vencido') return `Venceu em ${dataBr(item.dataVencimento)}`;
  if (s === 'vence_hoje') return 'Vence hoje';
  if ((s === 'urgente' || s === 'atencao') && dias !== null) return dias === 1 ? 'Vence amanhã' : `Vence em ${emDias(dias)}`;
  return `Vence em ${dataBr(item.dataVencimento)}`;
}

/** Texto curto da pílula na lista de documentos: "Vencido", "Vence hoje", "Vence em 12 dias". */
export function textoPilula(item: ItemResumo): string {
  if (item.estado === 'resolvido') return 'Em dia';
  const s = situacaoDe(item);
  const dias = item.analise?.diasRestantes ?? null;
  if (s === 'vencido') return 'Vencido';
  if (s === 'vence_hoje') return 'Vence hoje';
  if (s === 'sem_prazo' || dias === null) return 'Sem data';
  return dias === 1 ? 'Vence amanhã' : `Vence em ${emDias(dias)}`;
}

/** Grupos usados pelos contadores do painel e pelo filtro da lista. */
export type GrupoSituacao = 'vencidos' | 'urgentes' | 'atencao' | 'a_vencer' | 'sem_data' | 'precisa_atencao';

export const GRUPOS: Record<GrupoSituacao, { nome: string; situacoes: Situacao[] }> = {
  precisa_atencao: { nome: 'Precisam de atenção', situacoes: ['vencido', 'vence_hoje', 'urgente', 'atencao'] },
  vencidos: { nome: 'Vencidos', situacoes: ['vencido'] },
  urgentes: { nome: 'Urgentes', situacoes: ['vence_hoje', 'urgente'] },
  atencao: { nome: 'Em atenção', situacoes: ['atencao'] },
  a_vencer: { nome: 'A vencer', situacoes: ['atencao', 'em_dia'] },
  sem_data: { nome: 'Sem data', situacoes: ['sem_prazo'] },
};

export function ehGrupo(valor: string | null): valor is GrupoSituacao {
  return !!valor && valor in GRUPOS;
}

/** Frase da situação atual no detalhe: "Vencido há 10 dias.", "Vence em 5 dias.". */
export function fraseSituacao(item: ItemResumo): string {
  if (item.estado === 'resolvido') {
    if (!item.resolvidoEm) return 'Em dia — pago.';
    return pagoComAtraso(item)
      ? `Em dia — pago com atraso em ${dataBr(item.resolvidoEm.slice(0, 10))}.`
      : `Em dia — pago em ${dataBr(item.resolvidoEm.slice(0, 10))}.`;
  }
  const s = situacaoDe(item);
  const dias = item.analise?.diasRestantes ?? null;
  if (s === 'sem_prazo' || dias === null) return 'Sem data de vencimento.';
  if (s === 'vencido') return `Vencido há ${emDias(-dias)}.`;
  if (s === 'vence_hoje') return 'Vence hoje.';
  if (dias === 1) return 'Vence amanhã.';
  return s === 'em_dia' ? `A vencer — vence em ${emDias(dias)}.` : `Vence em ${emDias(dias)}.`;
}

/** Soma (ou subtrai) dias de uma data AAAA-MM-DD sem depender de fuso. */
export function somarDiasData(data: string, dias: number): string {
  const [a, m, d] = data.split('-').map(Number);
  const t = new Date(Date.UTC(a!, m! - 1, d! + dias));
  return t.toISOString().slice(0, 10);
}

/** Pago depois da data de vencimento? */
export function pagoComAtraso(item: ItemResumo): boolean {
  return !!(item.resolvidoEm && item.dataVencimento && item.resolvidoEm.slice(0, 10) > item.dataVencimento);
}

/** Hoje (AAAA-MM-DD) no fuso do Brasil. */
export function hojeLocal(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

/** Data de pagamento sugerida: o vencimento, se já passou ou é hoje; senão, hoje. */
export function pagamentoSugerido(dataVencimento: string | null | undefined): string {
  const hoje = hojeLocal();
  return dataVencimento && dataVencimento <= hoje ? dataVencimento : hoje;
}

/**
 * Vence hoje ou amanhã e ainda não foi pago: o item fica piscando até ser pago.
 * No dia seguinte ao vencimento ele vira "Vencido" e para de piscar.
 */
export function venceLogo(item: ItemResumo): 'hoje' | 'amanha' | null {
  if (item.estado !== 'ativo') return null;
  const s = situacaoDe(item);
  if (s === 'vence_hoje') return 'hoje';
  if (s !== 'vencido' && item.analise?.diasRestantes === 1) return 'amanha';
  return null;
}

/** Classe CSS do pisca-pisca ('' quando não pisca). */
export function classePiscar(item: ItemResumo): string {
  const quando = venceLogo(item);
  return quando ? `piscando piscando--${quando}` : '';
}

/** Etiqueta de um item pago: verde se pagou até o vencimento, laranja se pagou depois. */
export function pilulaPago(item: ItemResumo): { texto: string; tom: Tom } {
  return pagoComAtraso(item) ? { texto: 'Pago com atraso', tom: 'laranja' } : { texto: 'Pago em dia', tom: 'verde' };
}
