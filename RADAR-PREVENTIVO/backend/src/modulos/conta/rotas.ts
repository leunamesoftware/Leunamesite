import { Hono } from 'hono';
import type { Ambiente, Dependencias } from '../../comum/ambiente.js';
import { lerJson } from '../../comum/validacao.js';
import { tokenDaRequisicao } from '../autenticacao/middleware.js';
import { atualizarConta, trocarSenha } from './servico.js';

export function rotasConta(deps: Dependencias) {
  const r = new Hono<Ambiente>();
  r.get('/', (c) => c.json({ ok: true, dados: c.get('usuario') }));
  r.put('/', async (c) => c.json({ ok: true, dados: await atualizarConta(deps, c.get('usuario').id, await lerJson(c.req.raw)) }));
  r.post('/senha', async (c) => {
    await trocarSenha(deps, c.get('usuario').id, tokenDaRequisicao(c.req.header('authorization')), await lerJson(c.req.raw));
    return c.json({ ok: true, dados: null });
  });
  return r;
}
