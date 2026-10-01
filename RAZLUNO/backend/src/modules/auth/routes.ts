import { Hono } from 'hono';
import type { AppEnv, Deps } from '../../common/env.js';
import { clientIp, hashIp, userAgent } from '../../common/request.js';
import { readJson } from '../../common/validation.js';
import { bearerToken } from './middleware.js';
import { forgotPassword, login, logout, resetPassword, signup, type RequestMeta } from './service.js';

export async function requestMeta(deps: Deps, c: Parameters<typeof clientIp>[0]): Promise<RequestMeta> {
  const ip = clientIp(c);
  return { ip, ipHash: await hashIp(ip, deps.config.ipHashSecret), userAgent: userAgent(c) };
}

export function authRoutes(deps: Deps) {
  const r = new Hono<AppEnv>();
  r.post('/signup', async (c) => c.json({ ok: true, data: await signup(deps, await readJson(c.req.raw), await requestMeta(deps, c)) }, 201));
  r.post('/login', async (c) => c.json({ ok: true, data: await login(deps, await readJson(c.req.raw), await requestMeta(deps, c)) }));
  r.post('/logout', async (c) => {
    const token = bearerToken(c.req.header('authorization'));
    if (token) await logout(deps, token);
    return c.json({ ok: true, data: null });
  });
  r.post('/password/forgot', async (c) => {
    await forgotPassword(deps, await readJson(c.req.raw), await requestMeta(deps, c));
    return c.json({ ok: true, data: null });
  });
  r.post('/password/reset', async (c) => {
    await resetPassword(deps, await readJson(c.req.raw), await requestMeta(deps, c));
    return c.json({ ok: true, data: null });
  });
  return r;
}
