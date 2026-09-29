import { z } from 'zod';
import type { EstadoItem, ItemDetalhe, ItemEntrada, Situacao } from '../../../../compartilhado/contratos.js';
import type { Dependencias } from '../../comum/ambiente.js';
import { ErroApp, erros } from '../../comum/erros.js';
import { novoId } from '../../comum/seguranca.js';
import { dataValida } from '../../comum/tempo.js';
import { validar } from '../../comum/validacao.js';
import { repositorioAlertas } from '../alertas/repositorio.js';
import { analisarItem, hojeLocal } from '../analise/servico.js';
import { repositorioAnexos, paraAnexo } from '../anexos/repositorio.js';
import { gerarOrientacao } from '../orientacao/gerador.js';
import { analiseDaLinha, paraResumo, repositorioItens, type LinhaItem } from './repositorio.js';

const dataOpcional = z
  .union([z.string().trim(), z.null()])
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || dataValida(v), 'Data inválida (use o formato AAAA-MM-DD).');

const esquemaItem = z
  .object({
    natureza: z.enum(['documento', 'prazo'], { errorMap: () => ({ message: 'Escolha: documento ou prazo.' }) }),
    titulo: z.string({ required_error: 'Informe o título.' }).trim().min(1, 'Informe o título.').max(120, 'Máximo de 120 caracteres.'),
    tipo: z.string({ required_error: 'Informe o tipo.' }).trim().min(1, 'Informe o tipo (ex.: CNH, Alvará, Contrato).').max(60, 'Máximo de 60 caracteres.'),
    descricao: z.union([z.string().trim().max(2000, 'Máximo de 2000 caracteres.'), z.null()]).optional().transform((v) => v || null),
    dataEmissao: dataOpcional,
    dataVencimento: dataOpcional,
    antecedenciaDias: z
      .union([z.number().int('Use um número inteiro de dias.').min(1, 'Mínimo 1 dia.').max(365, 'Máximo 365 dias.'), z.null()])
      .optional()
      .transform((v) => v ?? null),
  })
  .refine((d) => !(d.dataEmissao && d.dataVencimento && d.dataEmissao > d.dataVencimento), {
    message: 'A data de vencimento não pode ser anterior à de emissão.',
    path: ['dataVencimento'],
  });

const SITUACOES = ['sem_prazo', 'em_dia', 'atencao', 'urgente', 'vence_hoje', 'vencido'] as const;
const ESTADOS = ['ativo', 'resolvido', 'arquivado'] as const;

async function linhaDoUsuario(deps: Dependencias, usuarioId: string, id: string): Promise<LinhaItem> {
  const linha = await repositorioItens.buscar(deps.banco, usuarioId, id);
  if (!linha) throw erros.naoEncontrado('Item');
  return linha;
}

export async function detalharItem(deps: Dependencias, usuarioId: string, id: string): Promise<ItemDetalhe> {
  const l = await linhaDoUsuario(deps, usuarioId, id);
  const analise = analiseDaLinha(l);
  if (!analise) throw new ErroApp('erro_interno', 500, 'Item ainda sem análise.');
  const [anexos, alertas] = await Promise.all([
    repositorioAnexos.listarDoItem(deps.banco, usuarioId, id),
    repositorioAlertas.listarDoItem(deps.banco, usuarioId, id),
  ]);
  return {
    ...paraResumo(l),
    descricao: l.descricao,
    dataEmissao: l.data_emissao,
    antecedenciaDias: l.antecedencia_dias,
    origemDados: l.origem_dados,
    criadoEm: l.criado_em,
    orientacao: gerarOrientacao(
      { natureza: l.natureza, titulo: l.titulo, dataVencimento: l.data_vencimento, antecedenciaDias: l.antecedencia_dias, estado: l.estado, resolvidoEm: l.resolvido_em },
      analise,
    ),
    anexos: anexos.map(paraAnexo),
    alertas,
  };
}

export async function listarItens(deps: Dependencias, usuarioId: string, consulta: Record<string, string | undefined>) {
  const estado = (ESTADOS as readonly string[]).includes(consulta.estado ?? '') ? (consulta.estado as EstadoItem) : 'ativo';
  const situacao = (SITUACOES as readonly string[]).includes(consulta.situacao ?? '') ? (consulta.situacao as Situacao) : undefined;
  const busca = consulta.busca?.trim().slice(0, 100) || undefined;
  return (await repositorioItens.listar(deps.banco, usuarioId, { estado, situacao, busca })).map(paraResumo);
}

/** RECEBER: cadastra o item e já analisa (situação + alertas) na hora. */
export async function criarItem(deps: Dependencias, usuarioId: string, entrada: unknown) {
  const d = validar(esquemaItem, entrada) as Required<ItemEntrada>;
  const id = novoId();
  const agora = deps.relogio.agora().toISOString();
  await deps.banco.transacao(async (banco) => {
    await repositorioItens.inserir(banco, { id, usuarioId, ...d, descricao: d.descricao ?? null, dataEmissao: d.dataEmissao ?? null, dataVencimento: d.dataVencimento ?? null, antecedenciaDias: d.antecedenciaDias ?? null, agora });
    const linha = await repositorioItens.buscar(banco, usuarioId, id);
    await analisarItem(deps, banco, linha!);
  });
  return detalharItem(deps, usuarioId, id);
}

export async function atualizarItem(deps: Dependencias, usuarioId: string, id: string, entrada: unknown) {
  const atual = await linhaDoUsuario(deps, usuarioId, id);
  if (atual.estado !== 'ativo') throw new ErroApp('item_resolvido', 409, 'Este item já foi pago e fica guardado no histórico.');
  const d = validar(esquemaItem, entrada) as Required<ItemEntrada>;
  const agora = deps.relogio.agora().toISOString();
  await deps.banco.transacao(async (banco) => {
    await repositorioItens.atualizar(banco, id, { ...d, descricao: d.descricao ?? null, dataEmissao: d.dataEmissao ?? null, dataVencimento: d.dataVencimento ?? null, antecedenciaDias: d.antecedenciaDias ?? null, agora });
    const linha = await repositorioItens.buscar(banco, usuarioId, id);
    await analisarItem(deps, banco, linha!);
  });
  return detalharItem(deps, usuarioId, id);
}

const esquemaPagamento = z.object({ pagoEm: dataOpcional }).optional().transform((v) => v ?? { pagoEm: null });

/**
 * Marcar como pago NÃO apaga nada: o item e seus alertas ficam registrados como pagos.
 * `pagoEm` (AAAA-MM-DD) é o dia em que a pessoa pagou; sem ele, vale o dia de hoje.
 * O horário gravado é meio-dia no fuso do Brasil, para a data nunca "virar" de dia.
 */
export async function resolverItem(deps: Dependencias, usuarioId: string, id: string, entrada?: unknown) {
  const { pagoEm } = validar(esquemaPagamento, entrada);
  const atual = await linhaDoUsuario(deps, usuarioId, id);
  if (atual.estado !== 'ativo') throw new ErroApp('item_resolvido', 409, 'Este item já está pago.');
  const hoje = hojeLocal(deps);
  if (pagoEm && pagoEm > hoje) throw erros.dadosInvalidos({ pagoEm: 'A data do pagamento não pode ser no futuro.' });
  const pagoEmIso = `${pagoEm ?? hoje}T15:00:00.000Z`;
  const agora = deps.relogio.agora().toISOString();
  await deps.banco.transacao(async (banco) => {
    await repositorioItens.marcarResolvido(banco, id, pagoEmIso, agora);
    await repositorioAlertas.resolverDoItem(banco, id, agora);
  });
  return detalharItem(deps, usuarioId, id);
}

/** Excluir (a pedido do usuário) apaga o item, seus alertas e os arquivos anexados. */
export async function excluirItem(deps: Dependencias, usuarioId: string, id: string) {
  await linhaDoUsuario(deps, usuarioId, id);
  const anexos = await repositorioAnexos.listarDoItem(deps.banco, usuarioId, id);
  await repositorioItens.excluir(deps.banco, id);
  for (const a of anexos) await deps.armazenamento.apagar(a.chave_arquivo);
}

export const tiposUsados = (deps: Dependencias, usuarioId: string) => repositorioItens.tiposUsados(deps.banco, usuarioId);
