import { Hono } from 'hono';
import type { Ambiente, Dependencias } from '../../comum/ambiente.js';
import { erros } from '../../comum/erros.js';
import { executarRotina } from './servico.js';

/** Permite que um agendador externo dispare a rotina (só com TOKEN_ROTINA configurado). */
export function rotasRotina(deps: Dependencias) {
  const r = new Hono<Ambiente>();
  r.post('/executar', async (c) => {
    if (!deps.config.tokenRotina) throw erros.naoEncontrado('Rota');
    if (c.req.header('x-token-rotina') !== deps.config.tokenRotina) throw erros.semPermissao();
    return c.json({ ok: true, dados: await executarRotina(deps) });
  });
  return r;
}
