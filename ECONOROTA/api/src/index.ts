import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';

import { ApiError } from './lib/errors';
import { rateLimit } from './lib/rateLimit';
import type { AppEnv } from './lib/types';
import auth from './routes/auth';
import account from './routes/account';
import catalog from './routes/catalog';
import compare from './routes/compare';
import geo from './routes/geo';
import orders from './routes/orders';
import payments, { webhooks } from './routes/payments';
import marketPanel from './routes/marketPanel';
import courier from './routes/courier';
import tracking from './routes/tracking';
import notifications from './routes/notifications';
import occurrences from './routes/occurrences';
import admin from './routes/admin';
import ratings from './routes/ratings';
import smartList from './routes/smartList';
import store from './routes/store';

const app = new Hono<AppEnv>();

app.use('*', secureHeaders());
app.use('*', (c, next) => {
  const allowed = (c.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return cors({
    origin: (origin) => (allowed.includes('*') ? '*' : allowed.includes(origin) ? origin : null),
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
  })(c, next);
});

// Corpo máximo: 6 MB (fotos de documentos e ocorrências até 5 MB; o resto é JSON pequeno).
app.use('*', bodyLimit({ maxSize: 6 * 1024 * 1024, onError: (c) => c.json({ error: { code: 'too_large', message: 'Arquivo ou dados grandes demais.' } }, 413) }));
// Respostas com dados da conta nunca ficam em cache (navegador, proxy ou CDN).
app.use('*', async (c, next) => {
  await next();
  if (c.req.header('Authorization') && !c.res.headers.has('Cache-Control')) c.res.headers.set('Cache-Control', 'no-store');
});
// Limites contra abuso e robôs (por IP, janela em segundos).
app.use('/auth/register', rateLimit('register', 10, 3600));
app.use('/auth/login', rateLimit('login', 30, 600));
app.use('/auth/google', rateLimit('google', 30, 600));
app.use('/auth/password/*', rateLimit('password', 10, 600));
app.use('/auth/verify/*', rateLimit('verify', 20, 600));
app.use('/me/orders', rateLimit('orders', 30, 600));
app.use('/me/orders/:id/pay', rateLimit('pay', 20, 600));
app.use('/me/orders/:id/ocorrencias', rateLimit('occurrence', 10, 3600));
app.use('/compare', rateLimit('compare', 120, 60));
app.use('/list/resolve', rateLimit('list', 120, 60));

app.get('/health', (c) => c.json({ ok: true, service: 'econorota-api' }));
/** Versão do app: abaixo da mínima, o app pede atualização (APP_MIN_VERSION, APP_LATEST_VERSION, APP_STORE_URL). */
app.get('/app/versao', (c) =>
  c.json({
    min_version: c.env.APP_MIN_VERSION ?? '1.0.0',
    latest_version: c.env.APP_LATEST_VERSION ?? c.env.APP_MIN_VERSION ?? '1.0.0',
    store_url: c.env.APP_STORE_URL ?? 'https://play.google.com/store/apps/details?id=com.leunamesoftwares.econorota',
  }),
);
app.route('/auth', auth);
app.route('/me', account);
app.route('/me', orders);
app.route('/me', payments);
app.route('/me', tracking);
app.route('/me', occurrences);
app.route('/me', notifications);
app.route('/admin', admin);
app.route('/avaliacoes', ratings);
app.route('/webhooks', webhooks);
app.route('/painel', marketPanel);
app.route('/entregador', courier);
app.route('/geo', geo);
app.route('/', catalog);
app.route('/', store);
app.route('/', compare);
app.route('/', smartList);

app.notFound((c) => c.json({ error: { code: 'not_found', message: 'Rota não encontrada.' } }, 404));
app.onError((err, c) => {
  if (err instanceof ApiError) return c.json({ error: { code: err.code, message: err.message } }, err.status);
  console.error(err);
  return c.json({ error: { code: 'internal', message: 'Erro interno.' } }, 500);
});

export default app;
