import type { Analise } from '../../../../compartilhado/contratos.js';
import type { Banco } from '../../infra/banco/tipos.js';

export const repositorioAnalises = {
  async salvar(banco: Banco, itemId: string, a: Analise) {
    await banco.executar(
      `INSERT INTO analises (item_id, situacao, dias_restantes, pendencias, analisado_em, versao_regras) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(item_id) DO UPDATE SET situacao = excluded.situacao, dias_restantes = excluded.dias_restantes,
         pendencias = excluded.pendencias, analisado_em = excluded.analisado_em, versao_regras = excluded.versao_regras`,
      [itemId, a.situacao, a.diasRestantes, JSON.stringify(a.pendencias), a.analisadoEm, a.versaoRegras],
    );
  },
};
