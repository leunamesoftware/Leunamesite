/** Configuration read from environment variables (see .env.example). */
export interface Config {
  production: boolean;
  port: number;
  dbPath: string;
  /** Extra secret mixed into passwords before hashing. Required in production. */
  passwordPepper: string;
  /** Secret used to hash IPs in logs (an IP is never stored in clear). */
  ipHashSecret: string;
  allowedOrigins: string[];
  sessionDays: number;
  /** Public URL of the app, used in e-mails and certificate links. */
  publicUrl: string;
  /** Login with Google/Apple only turns on when its client id is configured. */
  googleClientId: string | null;
  appleClientId: string | null;
  /** Outgoing e-mail provider. Without it, password recovery answers "unavailable" (never pretends it sent). */
  emailProvider: string | null;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const production = env.NODE_ENV === 'production';
  const pepper = env.PASSWORD_PEPPER ?? '';
  const ipSecret = env.IP_HASH_SECRET ?? '';
  if (production && pepper.length < 16) throw new Error('PASSWORD_PEPPER must be set (16+ chars) in production.');
  if (production && ipSecret.length < 16) throw new Error('IP_HASH_SECRET must be set (16+ chars) in production.');
  return {
    production,
    port: Number(env.PORT ?? 8788),
    dbPath: env.DB_PATH ?? './data/razluno.db',
    passwordPepper: pepper || 'development-only-pepper',
    ipHashSecret: ipSecret || 'development-only-ip-secret',
    allowedOrigins: (env.ALLOWED_ORIGINS ?? 'http://localhost:5174').split(',').map((o) => o.trim()).filter(Boolean),
    sessionDays: Number(env.SESSION_DAYS ?? 30),
    publicUrl: env.PUBLIC_URL ?? 'http://localhost:5174',
    googleClientId: env.GOOGLE_CLIENT_ID || null,
    appleClientId: env.APPLE_CLIENT_ID || null,
    emailProvider: env.EMAIL_PROVIDER || null,
  };
}
