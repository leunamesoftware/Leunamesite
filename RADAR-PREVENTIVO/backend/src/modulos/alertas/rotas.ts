import { Hono } from 'hono';
import type { Ambiente, Dependencias } from '../../comum/ambiente.js';
import { erros } from '../../comum/erros.js';
import { repositorioAlertas } from './repositorio.js';

export function rotasAlertas(deps: Dependencias) {
  const r = new Hono<Ambiente>();
  const agora = () => deps.relogio.agora().toISOString();

  r.get('/', async (c) => {
    const naoLidos = c.req.query('nao_lidos') === '1';
    return c.json({ ok: true, dados: await repositorioAlertas.listar(deps.banco, c.get('usuario').id, { naoLidos }) });
  });
  r.get('/contagem', async (c) => {
    return c.json({ ok: true, dados: { naoLidos: await repositorioAlertas.contarNaoLidos(deps.banco, c.get('usuario').id) } });
  });
  r.post('/lidos', async (c) => {
    const n = await repositorioAlertas.marcarTodosLidos(deps.banco, c.get('usuario').id, agora());
    return c.json({ ok: true, dados: { marcados: n } });
  });
  r.post('/:id/lido', async (c) => {
    const ok = await repositorioAlertas.marcarLido(deps.banco, c.get('usuario').id, c.req.param('id'), agora());
    if (!ok) throw erros.naoEncontrado('Alerta');
    return c.json({ ok: true, dados: null });
  });
  return r;
}
