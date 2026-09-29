import type { CodigoErro } from '../../../compartilhado/contratos.js';

/** Erro esperado (regra de negócio, dado inválido...), com a resposta certa para o usuário. */
export class ErroApp extends Error {
  constructor(
    public readonly codigo: CodigoErro,
    public readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 500,
    mensagem: string,
    public readonly campos?: Record<string, string>,
  ) {
    super(mensagem);
  }
}

export const erros = {
  dadosInvalidos: (campos: Record<string, string>) => new ErroApp('dados_invalidos', 400, 'Confira os campos destacados.', campos),
  naoAutenticado: () => new ErroApp('nao_autenticado', 401, 'Sua sessão expirou. Entre de novo.'),
  semPermissao: () => new ErroApp('sem_permissao', 403, 'Você não tem permissão para isso.'),
  naoEncontrado: (oque = 'Registro') => new ErroApp('nao_encontrado', 404, `${oque} não encontrado.`),
};
