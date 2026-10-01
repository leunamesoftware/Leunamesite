import { createMiddleware } from 'hono/factory';
import type { Role } from '../../../../shared/contracts.js';
import type { AppEnv, Deps } from '../../common/env.js';
import { errors } from '../../common/errors.js';
import { resolveSession } from './service.js';

export const bearerToken = (header: string | undefined) => (header?.startsWith('Bearer ') ? header.slice(7).trim() : '');

/** Requires a valid session; puts the user in c.get('me'). */
export const requireAuth = (deps: Deps) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const token = bearerToken(c.req.header('authorization'));
    const found = token ? await resolveSession(deps, token) : null;
    if (!found) throw errors.unauthenticated();
    c.set('me', found.me);
    c.set('sessionTokenHash', found.tokenHash);
    await next();
  });

/** Requires at least one of the roles. Always checked on the server, never trusted from the app. */
export const requireRole = (...roles: Role[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (!c.get('me').roles.some((r) => roles.includes(r))) throw errors.forbidden();
    await next();
  });
