import type { Dependencias } from '../../comum/ambiente.js';
import { analisarItem, hojeLocal } from '../analise/servico.js';
import { repositorioItens } from '../itens/repositorio.js';

export interface ResultadoRotina {
  data: string;
  itensAnalisados: number;
  alertasCriados: number;
  falhas: number;
}

/**
 * Rotina diária: reanalisa todos os itens ativos (de todos os usuários) e gera os
 * alertas do dia. Pode rodar mais de uma vez no mesmo dia sem duplicar alertas.
 */
/** Registros de segurança (tentativas de login, sessões encerradas) guardados por no máximo 7 dias. */
export const DIAS_REGISTROS_SEGURANCA = 7;

export async function executarRotina(deps: Dependencias): Promise<ResultadoRotina> {
  const limite = new Date(deps.relogio.agora().getTime() - DIAS_REGISTROS_SEGURANCA * 86_400_000).toISOString();
  await deps.banco.executar('DELETE FROM tentativas_login WHERE criado_em < ?', [limite]);
  await deps.banco.executar('DELETE FROM sessoes WHERE expira_em < ? OR (encerrada_em IS NOT NULL AND encerrada_em < ?)', [limite, limite]);

  const itens = await repositorioItens.listarAtivosDeTodos(deps.banco);
  let alertasCriados = 0;
  let falhas = 0;
  for (const linha of itens) {
    try {
      const r = await deps.banco.transacao((banco) => analisarItem(deps, banco, linha));
      alertasCriados += r.alertasCriados;
    } catch (erro) {
      falhas++;
      console.error(`[rotina] falha ao analisar item ${linha.id}:`, erro);
    }
  }
  return { data: hojeLocal(deps), itensAnalisados: itens.length, alertasCriados, falhas };
}
