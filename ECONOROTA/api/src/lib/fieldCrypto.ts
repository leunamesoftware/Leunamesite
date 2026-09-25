/**
 * Criptografia de dados pessoais no banco (Fase 17): CPF, CNH e chaves Pix ficam cifrados com AES-256-GCM.
 * Chave: segredo DATA_KEY (32 bytes em base64; gere com `openssl rand -base64 32`). Sem a chave (só em
 * desenvolvimento, com DEV_MODE) os valores ficam em texto; em produção sem a chave a gravação é recusada. Valores antigos em texto continuam legíveis e são cifrados na próxima gravação.
 */
const PREFIX = 'enc:v1:';
let cached: { raw: string; key: CryptoKey } | null = null;

type KeyEnv = { DATA_KEY?: string; DEV_MODE?: string };

async function dataKey(env: KeyEnv) {
  if (!env.DATA_KEY) return null;
  if (cached?.raw === env.DATA_KEY) return cached.key;
  const bytes = Uint8Array.from(atob(env.DATA_KEY), (ch) => ch.charCodeAt(0));
  if (bytes.length !== 32) throw new Error('DATA_KEY deve ter 32 bytes em base64.');
  const key = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
  cached = { raw: env.DATA_KEY, key };
  return key;
}

const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));

export async function seal(env: KeyEnv, value: string | null | undefined): Promise<string | null> {
  if (value == null || value === '') return value ?? null;
  const key = await dataKey(env);
  if (!key) {
    // Produção sem DATA_KEY: não grava documento em texto aberto.
    if (env.DEV_MODE !== 'true') throw new Error('DATA_KEY não configurada: configure o segredo antes de receber dados pessoais.');
    return value;
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value)));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return PREFIX + b64(out);
}

export async function unseal(env: KeyEnv, value: string | null | undefined): Promise<string | null> {
  if (value == null || !value.startsWith(PREFIX)) return value ?? null;
  const key = await dataKey(env);
  if (!key) throw new Error('Dado cifrado, mas DATA_KEY não está configurada.');
  const all = Uint8Array.from(atob(value.slice(PREFIX.length)), (ch) => ch.charCodeAt(0));
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, key, all.slice(12));
  return new TextDecoder().decode(pt);
}

/** Decifra vários campos de um registro. */
export async function unsealRow<T extends Record<string, unknown>>(env: KeyEnv, row: T, fields: (keyof T)[]): Promise<T> {
  const out = { ...row };
  for (const f of fields) out[f] = (await unseal(env, row[f] as string | null)) as T[keyof T];
  return out;
}
