// Hash de senha (PBKDF2-SHA256) e JWT HS256 usando apenas WebCrypto nativo do Workers.

const enc = new TextEncoder();
const ITERATIONS = 100_000; // máximo suportado pelo Workers

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const fromB64url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

/** Formato: pbkdf2$<iterações>$<salt>$<hash> */
export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${b64url(salt)}$${b64url(hash)}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algo, iter, salt, hash] = stored.split('$');
  if (algo !== 'pbkdf2' || !iter || !salt || !hash) return false;
  const computed = await pbkdf2(password, fromB64url(salt), Number(iter));
  return timingSafeEqual(computed, fromB64url(hash));
}

const hmacKey = (secret: string) =>
  crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

export type TokenPayload = { sub: string; role: string; tv: number; iat: number; exp: number };

export async function signToken(payload: Omit<TokenPayload, 'iat' | 'exp'>, secret: string, ttlHours: number) {
  const now = Math.floor(Date.now() / 1000);
  const body: TokenPayload = { ...payload, iat: now, exp: now + ttlHours * 3600 };
  const head = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const data = `${head}.${b64url(enc.encode(JSON.stringify(body)))}`;
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(data));
  return `${data}.${b64url(sig)}`;
}

export async function verifyToken(token: string, secret: string): Promise<TokenPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [head, body, sig] = parts;
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromB64url(sig), enc.encode(`${head}.${body}`));
    if (!ok) return null;
    const header = JSON.parse(new TextDecoder().decode(fromB64url(head)));
    if (header.alg !== 'HS256') return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body))) as TokenPayload;
    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
}

export const newId = () => crypto.randomUUID();

/** Compara segredos em tempo constante (ex.: token do webhook). */
export const safeEqualText = (a: string, b: string) => timingSafeEqual(enc.encode(a), enc.encode(b));
