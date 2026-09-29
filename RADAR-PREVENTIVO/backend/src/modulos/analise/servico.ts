import type { Analise, ItemResumo, ResumoRadar, Situacao } from '../../../../compartilhado/contratos.js';
import type { Dependencias } from '../../comum/ambiente.js';
import { dataLocal } from '../../comum/tempo.js';
import type { Banco } from '../../infra/banco/tipos.js';
import { repositorioAlertas } from '../alertas/repositorio.js';
import { processarAlertas } from '../alertas/servico.js';
import { analiseDaLinha, paraResumo, repositorioItens, type LinhaItem } from '../itens/repositorio.js';
import { analisar, GRAVIDADE, VERSAO_REGRAS } from './motor.js';
import { repositorioAnalises } from './repositorio.js';

export const hojeLocal = (deps: Pick<Dependencias, 'relogio' | 'config'>) => dataLocal(deps.relogio.agora(), deps.config.fusoHorario);

/**
 * Analisa um item ativo: calcula a situação, guarda o resultado e gera os alertas
 * que couberem. Chamado ao salvar/editar um item e pela rotina diária.
 */
export async function analisarItem(deps: Dependencias, banco: Banco, linha: LinhaItem): Promise<{ analise: Analise; alertasCriados: number }> {
  const agora = deps.relogio.agora().toISOString();
  const hoje = hojeLocal(deps);
  const resultado = analisar({ dataVencimento: linha.data_vencimento, antecedenciaDias: linha.antecedencia_dias }, hoje);
  const analise: Analise = { ...resultado, analisadoEm: agora, versaoRegras: VERSAO_REGRAS };
  const anterior = analiseDaLinha(linha);
  await repositorioAnalises.salvar(banco, linha.id, analise);
  const alertasCriados = await processarAlertas(
    deps, banco,
    { id: linha.id, usuarioId: linha.usuario_id, titulo: linha.titulo, dataVencimento: linha.data_vencimento },
    anterior, analise, hoje, agora,
  );
  return { analise, alertasCriados };
}

const SITUACOES: Situacao[] = ['sem_prazo', 'em_dia', 'atencao', 'urgente', 'vence_hoje', 'vencido'];

/** Resumo do painel "Radar". "Atenção agora" = urgentes, vence hoje e vencidos; "Próximos" = os demais com data. */
export async function resumoRadar(deps: Dependencias, usuarioId: string): Promise<ResumoRadar> {
  const ativos = (await repositorioItens.listar(deps.banco, usuarioId, { estado: 'ativo' })).map(paraResumo);
  const resolvidos = await deps.banco.um<{ n: number }>(`SELECT COUNT(*) AS n FROM itens WHERE usuario_id = ? AND estado = 'resolvido'`, [usuarioId]);
  const contagem = Object.fromEntries(SITUACOES.map((s) => [s, 0])) as Record<Situacao, number>;
  for (const item of ativos) if (item.analise) contagem[item.analise.situacao]++;
  const situacao = (i: ItemResumo) => i.analise?.situacao ?? 'sem_prazo';
  const atencaoAgora = ativos
    .filter((i) => GRAVIDADE[situacao(i)] >= GRAVIDADE.urgente)
    .sort((a, b) => GRAVIDADE[situacao(b)] - GRAVIDADE[situacao(a)] || (a.dataVencimento ?? '').localeCompare(b.dataVencimento ?? ''));
  const proximos = ativos
    .filter((i) => i.dataVencimento && GRAVIDADE[situacao(i)] < GRAVIDADE.urgente)
    .slice(0, 5);
  const pendencias = ativos.filter((i) => (i.analise?.pendencias.length ?? 0) > 0);
  return {
    contagem,
    totalAtivos: ativos.length,
    totalResolvidos: Number(resolvidos?.n ?? 0),
    atencaoAgora,
    proximos,
    pendencias,
    alertasNaoLidos: await repositorioAlertas.contarNaoLidos(deps.banco, usuarioId),
  };
}
