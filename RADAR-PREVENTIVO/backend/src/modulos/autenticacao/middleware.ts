import { createMiddleware } from 'hono/factory';
import type { Papel } from '../../../../compartilhado/contratos.js';
import type { Ambiente, Dependencias } from '../../comum/ambiente.js';
import { erros } from '../../comum/erros.js';
import { sha256 } from '../../comum/seguranca.js';
import { paraUsuario, repositorioAuth } from './repositorio.js';

export const tokenDaRequisicao = (cabecalho: string | undefined) =>
  cabecalho?.startsWith('Bearer ') ? cabecalho.slice(7).trim() : '';

/** Exige sessão válida; coloca o usuário em c.get('usuario'). */
export const exigirLogin = (deps: Dependencias) =>
  createMiddleware<Ambiente>(async (c, next) => {
    const token = tokenDaRequisicao(c.req.header('authorization'));
    if (!token) throw erros.naoAutenticado();
    const u = await repositorioAuth.usuarioDaSessao(deps.banco, await sha256(token), deps.relogio.agora().toISOString());
    if (!u) throw erros.naoAutenticado();
    c.set('usuario', paraUsuario(u));
    await next();
  });

/** Preparado para o painel administrativo futuro (não usado na V1). */
export const exigirPapel = (papel: Papel) =>
  createMiddleware<Ambiente>(async (c, next) => {
    if (c.get('usuario').papel !== papel) throw erros.semPermissao();
    await next();
  });
