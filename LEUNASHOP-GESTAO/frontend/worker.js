// ConstruGestão: serve os arquivos do app e leva /loja-api/* ao servidor de contas da loja LeuApps
// (o mesmo login de todos os apps). O cookie da conta vale em *.leunamesoftware.com.br.
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/loja-api/') && env.CONTAS) {
      url.pathname = '/api/' + url.pathname.slice('/loja-api/'.length);
      // O aviso do Mercado Pago só chega pelo endereço do próprio servidor de vendas.
      if (url.pathname === '/api/mp/aviso') return new Response('Não encontrado.', { status: 404 });
      return env.CONTAS.fetch(new Request(url, req));
    }
    return env.ASSETS.fetch(req);
  },
};
