import { Hono } from 'hono';
import type { Ambiente, Dependencias } from '../../comum/ambiente.js';
import { enviarAnexo, excluirAnexo, lerAnexo, TAMANHO_MAXIMO } from './servico.js';
import { ErroApp } from '../../comum/erros.js';

export function rotasAnexos(deps: Dependencias) {
  const r = new Hono<Ambiente>();
  r.post('/itens/:itemId/anexos', async (c) => {
    const tamanho = Number(c.req.header('content-length') ?? 0);
    if (tamanho > TAMANHO_MAXIMO + 64 * 1024) throw new ErroApp('arquivo_grande_demais', 413, 'O arquivo passa de 10 MB.');
    const corpo = await c.req.parseBody();
    const anexo = await enviarAnexo(deps, c.get('usuario').id, c.req.param('itemId'), corpo.arquivo);
    return c.json({ ok: true, dados: anexo }, 201);
  });
  r.get('/anexos/:id/arquivo', async (c) => {
    const { conteudo, formato, nome } = await lerAnexo(deps, c.get('usuario').id, c.req.param('id'));
    return new Response(conteudo as unknown as BodyInit, {
      headers: {
        'Content-Type': formato,
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(nome)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  });
  r.delete('/anexos/:id', async (c) => {
    await excluirAnexo(deps, c.get('usuario').id, c.req.param('id'));
    return c.json({ ok: true, dados: null });
  });
  return r;
}
