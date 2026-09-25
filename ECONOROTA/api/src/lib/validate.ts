import { badRequest } from './errors';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    /* corpo inválido */
  }
  throw badRequest('JSON inválido.');
}

export function str(body: Record<string, unknown>, key: string, opts: { min?: number; max?: number; optional?: boolean } = {}) {
  const v = body[key];
  if (v === undefined || v === null || v === '') {
    if (opts.optional) return undefined;
    throw badRequest(`Campo obrigatório: ${key}.`, 'validation');
  }
  if (typeof v !== 'string') throw badRequest(`Campo inválido: ${key}.`, 'validation');
  const s = v.trim();
  if (s.length < (opts.min ?? 1) || s.length > (opts.max ?? 255)) throw badRequest(`Tamanho inválido: ${key}.`, 'validation');
  return s;
}

export function email(body: Record<string, unknown>) {
  const e = str(body, 'email', { max: 254 })!.toLowerCase();
  if (!EMAIL.test(e)) throw badRequest('E-mail inválido.', 'validation');
  return e;
}

export function password(body: Record<string, unknown>) {
  const p = body.password;
  if (typeof p !== 'string' || p.length < 8 || p.length > 128) {
    throw badRequest('A senha deve ter entre 8 e 128 caracteres.', 'validation');
  }
  return p;
}

export function oneOf<T extends string>(body: Record<string, unknown>, key: string, values: readonly T[]) {
  const v = body[key];
  if (typeof v !== 'string' || !values.includes(v as T)) throw badRequest(`Campo inválido: ${key}.`, 'validation');
  return v as T;
}
