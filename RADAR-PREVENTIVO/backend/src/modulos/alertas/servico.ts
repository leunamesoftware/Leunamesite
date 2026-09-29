import { FAIXAS, type Analise, type MotivoAlerta, type Situacao } from '../../../../compartilhado/contratos.js';
import type { Dependencias } from '../../comum/ambiente.js';
import { novoId } from '../../comum/seguranca.js';
import { dataLocal, diferencaDias } from '../../comum/tempo.js';
import type { Banco } from '../../infra/banco/tipos.js';
import { GRAVIDADE } from '../analise/motor.js';
import { dataBr, dias } from '../orientacao/gerador.js';
import { repositorioAlertas } from './repositorio.js';

export interface ItemParaAlerta {
  id: string;
  usuarioId: string;
  titulo: string;
  dataVencimento: string | null;
}

function mensagem(motivo: MotivoAlerta, situacao: Situacao, item: ItemParaAlerta, n: number): string {
  const t = `"${item.titulo}"`;
  const data = item.dataVencimento ? dataBr(item.dataVencimento) : '';
  if (motivo === 'lembrete_vencido') return `Lembrete: ${t} está vencido há ${dias(Math.abs(n))} (${data}).`;
  switch (situacao) {
    case 'atencao': return `${t} pede atenção: vence em ${dias(n)} (${data}).`;
    case 'urgente': return `${t} está urgente: vence em ${dias(n)} (${data}).`;
    case 'vence_hoje': return `${t} vence hoje (${data}).`;
    case 'vencido': return `${t} venceu em ${data}.`;
    default: return `${t} mudou de situação.`;
  }
}

/**
 * ALERTAR: compara a análise anterior com a nova e decide se nasce alerta.
 * - Nasce alerta quando o item passa para uma situação pior (a partir de "atenção").
 * - Item vencido e não resolvido ganha um lembrete a cada 7 dias depois do alerta de vencido.
 * - Se a situação melhorou (ex.: data atualizada), os alertas antigos do item são fechados.
 * A chave única impede o mesmo alerta de aparecer duas vezes.
 */
export async function processarAlertas(
  deps: Pick<Dependencias, 'canaisAlerta' | 'config'>,
  banco: Banco,
  item: ItemParaAlerta,
  anterior: Pick<Analise, 'situacao'> | null,
  nova: Pick<Analise, 'situacao' | 'diasRestantes'>,
  hoje: string,
  agora: string,
): Promise<number> {
  const gravNova = GRAVIDADE[nova.situacao];
  const gravAnterior = anterior ? GRAVIDADE[anterior.situacao] : 0;
  const n = nova.diasRestantes ?? 0;
  const aCriar: { motivo: MotivoAlerta; chave: string }[] = [];

  if (anterior && gravNova < gravAnterior) {
    await repositorioAlertas.resolverDoItem(banco, item.id, agora);
  }
  if (gravNova >= GRAVIDADE.atencao && gravNova > gravAnterior) {
    aCriar.push({ motivo: 'mudou_situacao', chave: `${item.id}|${nova.situacao}|${item.dataVencimento}` });
  }
  // Lembrete semanal contado a partir do alerta de "vencido": 1 semana depois, 2 semanas...
  // Se a rotina não rodar num dia, o lembrete daquela semana sai na próxima execução, e nunca repete.
  if (nova.situacao === 'vencido') {
    const chaveVencido = `${item.id}|vencido|${item.dataVencimento}`;
    const primeiro = await repositorioAlertas.criadoEmPorChave(banco, chaveVencido);
    if (primeiro) {
      const semana = Math.floor(diferencaDias(dataLocal(new Date(primeiro), deps.config.fusoHorario), hoje) / FAIXAS.lembreteVencidoDias);
      if (semana >= 1) aCriar.push({ motivo: 'lembrete_vencido', chave: `${item.id}|lembrete|${item.dataVencimento}|${semana}` });
    }
  }

  let criados = 0;
  for (const { motivo, chave } of aCriar) {
    const alerta = await repositorioAlertas.criar(banco, {
      id: novoId(), usuarioId: item.usuarioId, itemId: item.id, motivo, situacao: nova.situacao,
      mensagem: mensagem(motivo, nova.situacao, item, n), chaveUnica: chave, criadoEm: agora,
    });
    if (!alerta) continue;
    criados++;
    for (const canal of deps.canaisAlerta) {
      let status: 'entregue' | 'falhou';
      try { status = await canal.entregar(alerta); } catch { status = 'falhou'; }
      await repositorioAlertas.registrarEntrega(banco, { id: novoId(), alertaId: alerta.id, canal: canal.nome, status, criadoEm: agora });
    }
  }
  return criados;
}
