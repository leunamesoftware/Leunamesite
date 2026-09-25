import type { Env } from './types';

type GoogleClaims = { sub: string; email: string; email_verified: boolean; name?: string; aud: string; iss: string; exp: number };

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const dec = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function jwks(): Promise<{ keys: (JsonWebKey & { kid: string })[] }> {
  // Cache HTTP do próprio Workers respeita o Cache-Control enviado pelo Google.
  const res = await fetch(JWKS_URL, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!res.ok) throw new Error('JWKS indisponível');
  return res.json();
}

/** Valida o ID token do Google (assinatura RS256, emissor, audiência e validade). */
export async function verifyGoogleIdToken(env: Env, idToken: string): Promise<GoogleClaims | null> {
  const audiences = (env.GOOGLE_CLIENT_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!audiences.length) return null;
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(new TextDecoder().decode(dec(parts[0])));
    if (header.alg !== 'RS256') return null;
    const jwk = (await jwks()).keys.find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, dec(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!ok) return null;
    const c = JSON.parse(new TextDecoder().decode(dec(parts[1]))) as GoogleClaims;
    const issOk = c.iss === 'accounts.google.com' || c.iss === 'https://accounts.google.com';
    if (!issOk || !audiences.includes(c.aud) || c.exp * 1000 < Date.now() || !c.email_verified) return null;
    return c;
  } catch {
    return null;
  }
}
