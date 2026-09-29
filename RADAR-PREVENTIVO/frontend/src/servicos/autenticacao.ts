import type { CadastroEntrada, EntrarEntrada, SessaoCriada } from '@compartilhado/contratos';
import { chamarApi } from './api';

export function entrar(dados: EntrarEntrada): Promise<SessaoCriada> {
  return chamarApi<SessaoCriada>('/auth/entrar', { metodo: 'POST', corpo: dados });
}

/** Cria a conta e já devolve a sessão aberta. */
export function cadastrar(dados: CadastroEntrada): Promise<SessaoCriada> {
  return chamarApi<SessaoCriada>('/auth/cadastro', { metodo: 'POST', corpo: dados });
}
