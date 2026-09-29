import { FAIXAS, type Pendencia, type Situacao } from '../../../../compartilhado/contratos.js';
import { diferencaDias } from '../../comum/tempo.js';

/** Versão das regras. Muda quando as regras mudarem; cada análise guarda qual versão usou. */
export const VERSAO_REGRAS = 'v1.0';

/** Quanto maior, mais grave. "Sem prazo" é pendência de cadastro, não gera alerta. */
export const GRAVIDADE: Record<Situacao, number> = {
  sem_prazo: 0,
  em_dia: 1,
  atencao: 2,
  urgente: 3,
  vence_hoje: 4,
  vencido: 5,
};

export interface DadosParaAnalise {
  dataVencimento: string | null;
  antecedenciaDias: number | null;
}

export interface ResultadoAnalise {
  situacao: Situacao;
  diasRestantes: number | null;
  pendencias: Pendencia[];
}

/**
 * ANALISAR + IDENTIFICAR: a partir das datas informadas, calcula a situação do item.
 * - Sem data de vencimento → "sem prazo" (pendência)
 * - Venceu → "vencido"; vence hoje → "vence hoje"
 * - Faltam até 7 dias → "urgente"
 * - Faltam até 30 dias (ou a antecedência do item) → "atenção"
 * - Senão → "em dia"
 */
export function analisar(dados: DadosParaAnalise, hoje: string): ResultadoAnalise {
  if (!dados.dataVencimento) {
    return { situacao: 'sem_prazo', diasRestantes: null, pendencias: ['sem_data_vencimento'] };
  }
  const dias = diferencaDias(hoje, dados.dataVencimento);
  const limiteAtencao = dados.antecedenciaDias ?? FAIXAS.atencaoDias;
  let situacao: Situacao;
  if (dias < 0) situacao = 'vencido';
  else if (dias === 0) situacao = 'vence_hoje';
  else if (dias <= FAIXAS.urgenteDias) situacao = 'urgente';
  else if (dias <= limiteAtencao) situacao = 'atencao';
  else situacao = 'em_dia';
  return { situacao, diasRestantes: dias, pendencias: [] };
}
