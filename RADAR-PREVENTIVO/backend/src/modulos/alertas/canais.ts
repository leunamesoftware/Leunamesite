import type { Alerta } from '../../../../compartilhado/contratos.js';

/**
 * Canal de entrega de alertas. Na V1 existe só o canal "app" (o alerta aparece dentro
 * do aplicativo). Push e e-mail serão novos canais no futuro, sem mudar a regra dos alertas.
 */
export interface CanalAlerta {
  nome: string;
  entregar(alerta: Alerta): Promise<'entregue' | 'falhou'>;
}

/** O alerta já fica disponível na central de alertas do app assim que é criado. */
export const canalApp: CanalAlerta = {
  nome: 'app',
  async entregar() {
    return 'entregue';
  },
};
