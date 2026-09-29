import type { ZodType, ZodTypeDef } from 'zod';
import { erros } from './erros.js';

/** Valida os dados recebidos; se algo estiver errado, responde dizendo qual campo. */
export function validar<T>(esquema: ZodType<T, ZodTypeDef, unknown>, dados: unknown): T {
  const r = esquema.safeParse(dados);
  if (r.success) return r.data;
  const campos: Record<string, string> = {};
  for (const problema of r.error.issues) {
    const campo = problema.path.join('.') || 'geral';
    if (!campos[campo]) campos[campo] = problema.message;
  }
  throw erros.dadosInvalidos(campos);
}

export async function lerJson(requisicao: Request): Promise<unknown> {
  try {
    return await requisicao.json();
  } catch {
    throw erros.dadosInvalidos({ geral: 'Envie os dados em formato JSON.' });
  }
}
