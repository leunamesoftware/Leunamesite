import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Ambiente, Dependencias } from './comum/ambiente.js';
import { ErroApp } from './comum/erros.js';
import { rotasAlertas } from './modulos/alertas/rotas.js';
import { rotasRadar } from './modulos/analise/rotas.js';
import { rotasAnexos } from './modulos/anexos/rotas.js';
import { exigirLogin } from './modulos/autenticacao/middleware.js';
import { rotasAutenticacao } from './modulos/autenticacao/rotas.js';
import { rotasConta } from './modulos/conta/rotas.js';
import { rotasItens } from './modulos/itens/rotas.js';
import { rotasRotina } from './modulos/rotina/rotas.js';

/** Monta a API. Não sabe nada de hospedagem: recebe banco, armazenamento etc. prontos. */
export function criarApp(deps: Dependencias) {
  const app = new Hono<Ambiente>();

  app.use('/api/*', cors({
    origin: (origem) => (deps.config.origensPermitidas.includes(origem) ? origem : null),
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    maxAge: 600,
  }));

  app.onError((erro, c) => {
    if (erro instanceof ErroApp) {
      return c.json({ ok: false, erro: erro.codigo, mensagem: erro.message, ...(erro.campos ? { campos: erro.campos } : {}) }, erro.status);
    }
    console.error('[api] erro inesperado:', erro);
    return c.json({ ok: false, erro: 'erro_interno', mensagem: 'Algo deu errado do nosso lado. Tente de novo em instantes.' }, 500);
  });
  app.notFound((c) => c.json({ ok: false, erro: 'nao_encontrado', mensagem: 'Rota não encontrada.' }, 404));

  app.get('/api/saude', (c) => c.json({ ok: true, dados: { status: 'ok' } }));

  // Públicas
  app.route('/api/auth', rotasAutenticacao(deps));
  app.route('/api/rotina', rotasRotina(deps));

  // Exigem login
  const logado = exigirLogin(deps);
  for (const caminho of ['/api/conta', '/api/conta/*', '/api/itens', '/api/itens/*', '/api/anexos/*', '/api/alertas', '/api/alertas/*', '/api/radar']) {
    app.use(caminho, logado);
  }
  app.route('/api/conta', rotasConta(deps));
  app.route('/api/itens', rotasItens(deps));
  app.route('/api', rotasAnexos(deps));
  app.route('/api/alertas', rotasAlertas(deps));
  app.route('/api/radar', rotasRadar(deps));
  // /api/admin: reservado para o painel administrativo futuro (não existe na V1).

  return app;
}
