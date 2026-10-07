// Standard Web Crypto: identical on Node 22 and Cloudflare Workers.
const crypto = globalThis.crypto;

// 100k iterations: strong and within the Workers PBKDF2 limit.
const ITERATIONS = 100_000;

const toHex = (bytes: ArrayBuffer | Uint8Array) =>
  Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex: string) => new Uint8Array((hex.match(/../g) ?? []).map((p) => parseInt(p, 16)));

async function derive(password: string, salt: Uint8Array, pepper: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password + pepper), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256);
  return toHex(bits);
}

/** Stored format: "pbkdf2$iterations$salt$hash". The password itself is never stored. */
export async function hashPassword(password: string, pepper: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${await derive(password, salt, pepper, ITERATIONS)}`;
}

export async function verifyPassword(password: string, stored: string, pepper: string): Promise<boolean> {
  const [algo, iterations, salt, hash] = stored.split('$');
  if (algo !== 'pbkdf2' || !iterations || !salt || !hash) return false;
  return constantTimeEqual(await derive(password, fromHex(salt), pepper, Number(iterations)), hash);
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Random session/one-time token (only ever sent to the user's device). */
export const randomToken = () => toHex(crypto.getRandomValues(new Uint8Array(32)));

export async function sha256(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

export const newId = () => crypto.randomUUID();
