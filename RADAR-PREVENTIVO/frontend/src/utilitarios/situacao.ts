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
  em_dia: 'Em dia',
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
  if (item.estado === 'resolvido') return 'Resolvido';
  const s = situacaoDe(item);
  const dias = item.analise?.diasRestantes ?? null;
  if (s === 'vencido') return 'Vencido';
  if (s === 'vence_hoje') return 'Vence hoje';
  if (s === 'sem_prazo' || dias === null) return 'Sem data';
  return dias === 1 ? 'Vence amanhã' : `Vence em ${emDias(dias)}`;
}

/** Grupos usados pelos contadores do painel e pelo filtro da lista. */
export type GrupoSituacao = 'vencidos' | 'urgentes' | 'atencao' | 'em_dia' | 'sem_data' | 'precisa_atencao';

export const GRUPOS: Record<GrupoSituacao, { nome: string; situacoes: Situacao[] }> = {
  precisa_atencao: { nome: 'Precisam de atenção', situacoes: ['vencido', 'vence_hoje', 'urgente', 'atencao'] },
  vencidos: { nome: 'Vencidos', situacoes: ['vencido'] },
  urgentes: { nome: 'Urgentes', situacoes: ['vence_hoje', 'urgente'] },
  atencao: { nome: 'Em atenção', situacoes: ['atencao'] },
  em_dia: { nome: 'Em dia', situacoes: ['em_dia'] },
  sem_data: { nome: 'Sem data', situacoes: ['sem_prazo'] },
};

export function ehGrupo(valor: string | null): valor is GrupoSituacao {
  return !!valor && valor in GRUPOS;
}
