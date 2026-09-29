import { Hono } from 'hono';
import type { Ambiente, Dependencias } from '../../comum/ambiente.js';
import { lerJson } from '../../comum/validacao.js';
import { atualizarItem, criarItem, detalharItem, excluirItem, listarItens, resolverItem, tiposUsados } from './servico.js';

export function rotasItens(deps: Dependencias) {
  const r = new Hono<Ambiente>();
  const uid = (c: { get(k: 'usuario'): { id: string } }) => c.get('usuario').id;

  // Rotas fixas antes das rotas com :id.
  r.get('/tipos', async (c) => c.json({ ok: true, dados: await tiposUsados(deps, uid(c)) }));
  r.get('/', async (c) => c.json({ ok: true, dados: await listarItens(deps, uid(c), c.req.query()) }));
  r.post('/', async (c) => c.json({ ok: true, dados: await criarItem(deps, uid(c), await lerJson(c.req.raw)) }, 201));
  r.get('/:id', async (c) => c.json({ ok: true, dados: await detalharItem(deps, uid(c), c.req.param('id')) }));
  r.put('/:id', async (c) => c.json({ ok: true, dados: await atualizarItem(deps, uid(c), c.req.param('id'), await lerJson(c.req.raw)) }));
  r.post('/:id/resolver', async (c) => c.json({ ok: true, dados: await resolverItem(deps, uid(c), c.req.param('id')) }));
  r.delete('/:id', async (c) => {
    await excluirItem(deps, uid(c), c.req.param('id'));
    return c.json({ ok: true, dados: null });
  });
  return r;
}
