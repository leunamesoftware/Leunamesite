import { sha256 } from './security.js';

type Ctx = { req: { header(name: string): string | undefined } };

/** Caller IP: Cloudflare header first, then the standard proxy header. */
export const clientIp = (c: Ctx) =>
  c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'local';

export const userAgent = (c: Ctx) => c.req.header('user-agent')?.slice(0, 300) ?? null;

/** IPs are personal data under GDPR: only a keyed hash is stored. */
export const hashIp = (ip: string, secret: string) => sha256(`${secret}:${ip}`);
