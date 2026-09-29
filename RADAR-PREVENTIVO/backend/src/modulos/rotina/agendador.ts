import type { Dependencias } from '../../comum/ambiente.js';
import { dataLocal, horaLocal } from '../../comum/tempo.js';
import { executarRotina } from './servico.js';

/**
 * Agendador simples para quando a API roda como processo contínuo: a cada 15 minutos
 * confere se já passou da hora da rotina hoje e se ela ainda não rodou; se sim, roda.
 * (Se a hospedagem escolhida tiver agendador próprio, ele chama executarRotina direto.)
 */
export function iniciarAgendador(deps: Dependencias): () => void {
  let ultimaData: string | null = null;
  let rodando = false;
  const verificar = async () => {
    if (rodando) return;
    const agora = deps.relogio.agora();
    const hoje = dataLocal(agora, deps.config.fusoHorario);
    if (ultimaData === hoje || horaLocal(agora, deps.config.fusoHorario) < deps.config.horaRotina) return;
    rodando = true;
    try {
      const r = await executarRotina(deps);
      ultimaData = hoje;
      console.log(`[rotina] ${r.data}: ${r.itensAnalisados} itens analisados, ${r.alertasCriados} alertas criados, ${r.falhas} falhas.`);
    } catch (erro) {
      console.error('[rotina] erro:', erro);
    } finally {
      rodando = false;
    }
  };
  void verificar();
  const timer = setInterval(verificar, 15 * 60_000);
  return () => clearInterval(timer);
}
