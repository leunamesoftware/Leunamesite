import type { CodigoErro, Resposta } from '@compartilhado/contratos';

// Único ponto do frontend que conversa com o backend.
// Em desenvolvimento o Vite repassa /api para o backend; em produção, VITE_URL_API
// aponta para onde o backend estiver hospedado.
const BASE = (import.meta.env.VITE_URL_API as string | undefined)?.replace(/\/$/, '') ?? '';

export type CodigoErroApp = CodigoErro | 'sem_conexao' | 'resposta_invalida';

export class ErroApi extends Error {
  constructor(
    public readonly codigo: CodigoErroApp,
    mensagem: string,
    public readonly campos: Record<string, string> = {},
  ) {
    super(mensagem);
  }
}

type Opcoes = {
  metodo?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  corpo?: unknown;
  token?: string | null;
};

export async function chamarApi<T>(caminho: string, { metodo = 'GET', corpo, token }: Opcoes = {}): Promise<T> {
  const cabecalhos: Record<string, string> = {};
  if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';
  if (token) cabecalhos.Authorization = `Bearer ${token}`;

  let resposta: Response;
  try {
    resposta = await fetch(`${BASE}/api${caminho}`, {
      method: metodo,
      headers: cabecalhos,
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    throw new ErroApi('sem_conexao', 'Não foi possível conectar. Verifique sua internet e tente de novo.');
  }

  let json: Resposta<T>;
  try {
    json = (await resposta.json()) as Resposta<T>;
  } catch {
    throw new ErroApi('resposta_invalida', 'O servidor respondeu de um jeito inesperado. Tente de novo em instantes.');
  }

  if (!json.ok) throw new ErroApi(json.erro, json.mensagem, json.campos);
  return json.dados;
}
