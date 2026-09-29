/** Configuração lida das variáveis de ambiente (veja .env.exemplo). */
export interface Config {
  porta: number;
  caminhoBanco: string;
  pastaAnexos: string;
  /** Segredo extra misturado às senhas antes do hash. Obrigatório em produção. */
  pimentaSenha: string;
  origensPermitidas: string[];
  /** Fuso usado para saber "que dia é hoje" nas análises. */
  fusoHorario: string;
  /** Hora local (0–23) em que a rotina diária roda. */
  horaRotina: number;
  /** Protege a rota que permite disparar a rotina por um agendador externo. */
  tokenRotina: string | null;
  diasSessao: number;
}

export function carregarConfig(ambiente: NodeJS.ProcessEnv = process.env): Config {
  const producao = ambiente.NODE_ENV === 'production';
  const pimenta = ambiente.PIMENTA_SENHA ?? '';
  if (producao && pimenta.length < 16) {
    throw new Error('PIMENTA_SENHA precisa estar definida (mínimo 16 caracteres) em produção.');
  }
  return {
    porta: Number(ambiente.PORTA ?? 8787),
    caminhoBanco: ambiente.CAMINHO_BANCO ?? './dados/radar.db',
    pastaAnexos: ambiente.PASTA_ANEXOS ?? './dados/anexos',
    pimentaSenha: pimenta || 'somente-desenvolvimento-troque-em-producao',
    origensPermitidas: (ambiente.ORIGENS_PERMITIDAS ?? 'http://localhost:5173').split(',').map((o) => o.trim()).filter(Boolean),
    fusoHorario: ambiente.FUSO_HORARIO ?? 'America/Sao_Paulo',
    horaRotina: Number(ambiente.HORA_ROTINA ?? 6),
    tokenRotina: ambiente.TOKEN_ROTINA || null,
    diasSessao: Number(ambiente.DIAS_SESSAO ?? 30),
  };
}
