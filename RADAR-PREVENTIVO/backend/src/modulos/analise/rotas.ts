import { Hono } from 'hono';
import type { Ambiente, Dependencias } from '../../comum/ambiente.js';
import { resumoRadar } from './servico.js';

export function rotasRadar(deps: Dependencias) {
  const r = new Hono<Ambiente>();
  r.get('/', async (c) => c.json({ ok: true, dados: await resumoRadar(deps, c.get('usuario').id) }));
  return r;
}
