import { Hono } from 'hono';
import type { Ambiente, Dependencias } from '../../comum/ambiente.js';
import { lerJson } from '../../comum/validacao.js';
import { tokenDaRequisicao } from './middleware.js';
import { cadastrar, entrar, sair } from './servico.js';

const ipDe = (c: { req: { header(n: string): string | undefined } }) =>
  c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';

export function rotasAutenticacao(deps: Dependencias) {
  const r = new Hono<Ambiente>();
  r.post('/cadastro', async (c) => c.json({ ok: true, dados: await cadastrar(deps, await lerJson(c.req.raw), ipDe(c)) }, 201));
  r.post('/entrar', async (c) => c.json({ ok: true, dados: await entrar(deps, await lerJson(c.req.raw), ipDe(c)) }));
  r.post('/sair', async (c) => {
    const token = tokenDaRequisicao(c.req.header('authorization'));
    if (token) await sair(deps, token);
    return c.json({ ok: true, dados: null });
  });
  return r;
}
