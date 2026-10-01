import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import type { AppEnv, Deps } from './common/env.js';
import { AppError } from './common/errors.js';
import { accountRoutes } from './modules/account/routes.js';
import { requireAuth } from './modules/auth/middleware.js';
import { authRoutes } from './modules/auth/routes.js';
import { catalogRoutes } from './modules/catalog/routes.js';

/** Builds the API. Knows nothing about hosting: receives database, config etc. ready-made. */
export function createApp(deps: Deps) {
  const app = new Hono<AppEnv>();

  app.use('/api/*', secureHeaders());
  app.use('/api/*', cors({
    origin: (origin) => (deps.config.allowedOrigins.includes(origin) ? origin : null),
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    maxAge: 600,
  }));

  app.onError((error, c) => {
    if (error instanceof AppError) {
      return c.json({ ok: false, error: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) }, error.status);
    }
    console.error('[api] unexpected error:', error);
    return c.json({ ok: false, error: 'internal_error', message: 'Something went wrong on our side. Try again shortly.' }, 500);
  });
  app.notFound((c) => c.json({ ok: false, error: 'not_found', message: 'Route not found.' }, 404));

  app.get('/api/health', (c) => c.json({ ok: true, data: { status: 'ok' } }));

  // Public
  app.route('/api/auth', authRoutes(deps));
  app.route('/api/public', catalogRoutes(deps));

  // Signed in
  app.use('/api/me', requireAuth(deps));
  app.use('/api/me/*', requireAuth(deps));
  app.route('/api/me', accountRoutes(deps));

  return app;
}
