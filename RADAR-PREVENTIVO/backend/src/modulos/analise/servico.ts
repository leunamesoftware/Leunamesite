import type { Analise, ItemResumo, ResumoFinanceiro, ResumoRadar, Situacao, TotalContas } from '../../../../compartilhado/contratos.js';
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

/**
 * Reanalisa os itens ativos do usuário cuja análise é de um dia anterior.
 * Assim, virou a meia-noite, "vence amanhã" já passa a "vence hoje" e "vence hoje" a "vencido"
 * na hora em que a pessoa abre o app, sem esperar a rotina diária.
 */
export async function atualizarAnalisesDoDia(deps: Dependencias, usuarioId: string): Promise<void> {
  const hoje = hojeLocal(deps);
  const linhas = await repositorioItens.listar(deps.banco, usuarioId, { estado: 'ativo' });
  for (const linha of linhas) {
    if (linha.a_em && dataLocal(new Date(linha.a_em), deps.config.fusoHorario) === hoje) continue;
    await deps.banco.transacao((banco) => analisarItem(deps, banco, linha));
  }
}

const SITUACOES: Situacao[] = ['sem_prazo', 'em_dia', 'atencao', 'urgente', 'vence_hoje', 'vencido'];

/** Resumo do painel "Radar". "Atenção agora" = urgentes, vence hoje e vencidos; "Próximos" = os demais com data. */
export async function resumoRadar(deps: Dependencias, usuarioId: string): Promise<ResumoRadar> {
  await atualizarAnalisesDoDia(deps, usuarioId);
  const ativos = (await repositorioItens.listar(deps.banco, usuarioId, { estado: 'ativo' })).map(paraResumo);
  const resolvidos = await deps.banco.um<{ n: number }>(`SELECT COUNT(*) AS n FROM itens WHERE usuario_id = ? AND estado = 'resolvido'`, [usuarioId]);
  const contagem = Object.fromEntries(SITUACOES.map((s) => [s, 0])) as Record<Situacao, number>;
  for (const item of ativos) if (item.analise) contagem[item.analise.situacao]++;
  const situacao = (i: ItemResumo) => i.analise?.situacao ?? 'sem_prazo';
  const atencaoAgora = ativos
    .filter((i) => GRAVIDADE[situacao(i)] >= GRAVIDADE.atencao)
    .sort((a, b) => GRAVIDADE[situacao(b)] - GRAVIDADE[situacao(a)] || (a.dataVencimento ?? '').localeCompare(b.dataVencimento ?? ''));
  const proximos = ativos
    .filter((i) => i.dataVencimento && situacao(i) === 'em_dia')
    .slice(0, 5);
  const pendencias = ativos.filter((i) => (i.analise?.pendencias.length ?? 0) > 0);
  return {
    contagem,
    totalAtivos: ativos.length,
    totalResolvidos: Number(resolvidos?.n ?? 0),
    atencaoAgora,
    proximos,
    pendencias,
    pagosRecentes: (await repositorioItens.listar(deps.banco, usuarioId, { estado: 'resolvido' })).slice(0, 5).map(paraResumo),
    alertasNaoLidos: await repositorioAlertas.contarNaoLidos(deps.banco, usuarioId),
    financeiro: await resumoFinanceiro(deps, usuarioId, ativos),
  };
}

const somar = (t: TotalContas, centavos: number) => { t.quantidade++; t.totalCentavos += centavos; };
const vazio = (): TotalContas => ({ quantidade: 0, totalCentavos: 0 });

/** Somas dos valores: a pagar por data, em atraso e o mês atual (pago × falta pagar). */
async function resumoFinanceiro(deps: Dependencias, usuarioId: string, ativos: ItemResumo[]): Promise<ResumoFinanceiro> {
  const hoje = hojeLocal(deps);
  const mes = hoje.slice(0, 7);
  const porData = new Map<string, TotalContas>();
  const emAtraso = vazio();
  const aPagar = vazio();
  let semValor = 0;
  for (const i of ativos) {
    if (!i.dataVencimento) continue;
    if (i.valorCentavos === null) { semValor++; continue; }
    if (i.dataVencimento < hoje) somar(emAtraso, i.valorCentavos);
    else {
      if (!porData.has(i.dataVencimento)) porData.set(i.dataVencimento, vazio());
      somar(porData.get(i.dataVencimento)!, i.valorCentavos);
    }
    if (i.dataVencimento.startsWith(mes)) somar(aPagar, i.valorCentavos);
  }
  // Pagos no mês: a data do pagamento é gravada ao meio-dia (horário de Brasília), então a margem de 1 dia basta.
  const pagos = await deps.banco.todos<{ resolvido_em: string; valor: number | null }>(
    `SELECT resolvido_em, COALESCE(valor_pago_centavos, valor_centavos) AS valor FROM itens
     WHERE usuario_id = ? AND estado = 'resolvido' AND resolvido_em >= ?`,
    [usuarioId, `${mes}-01`],
  );
  const pago = vazio();
  for (const p of pagos) {
    if (p.valor === null || dataLocal(new Date(p.resolvido_em), deps.config.fusoHorario).slice(0, 7) !== mes) continue;
    somar(pago, Number(p.valor));
  }
  return {
    porData: [...porData.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(0, 5).map(([data, t]) => ({ data, ...t })),
    emAtraso,
    mes: { referencia: mes, pago, aPagar },
    semValor,
  };
}
