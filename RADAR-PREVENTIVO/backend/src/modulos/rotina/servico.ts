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
export async function executarRotina(deps: Dependencias): Promise<ResultadoRotina> {
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
