// Servidor de licenças da LeuName Softwares — Cloudflare Worker + D1.
// Reusavel para todos os apps (LeuName Gestão e futuros), todos os idiomas.
//
// IMPORTANTE: o segredo abaixo tem que ser IDENTICO ao LICENSE_LOCAL_SECRET
// embutido no app (PROJETO/leuname-gestao.html e suas copias em
// WINDOWS/.../app/index.html e ANDROID/.../www/index.html), e identico ao
// SECRET usado em PROJETO/gerador-chave-ativacao-local/gerar-chave.js.
// Se um dia trocar esse valor em algum lugar, troque nos tres.
const LICENSE_LOCAL_SECRET = 'LeuName-Ativacao-Local-PrimeiroCliente-2026-v1';
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function randomGroup(len = 4) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

async function licenseChecksum(g1, g2) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(LICENSE_LOCAL_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`LEU-${g1}-${g2}`));
  return Array.from(new Uint8Array(sig)).slice(0, 2)
    .map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join('');
}

async function gerarChave() {
  const g1 = randomGroup();
  const g2 = randomGroup();
  const g3 = await licenseChecksum(g1, g2);
  return `LEU-${g1}-${g2}-${g3}`;
}

// Confere se uma chave tem o formato certo e o checksum bate — mesma
// validacao que o app faz localmente (licenseKeyValid no index.html).
// Usado para autenticar as rotas de sincronizacao: qualquer dispositivo
// com uma chave valida pode ler/escrever os dados daquela chave, sem
// precisar de login/senha separados (a chave de licenca já é o "id da
// loja" compartilhado entre os aparelhos dela).
async function chaveValida(chave) {
  if (typeof chave !== 'string') return false;
  const m = /^LEU-([0-9A-Z]{4})-([0-9A-Z]{4})-([0-9A-Z]{4})$/.exec(chave.trim().toUpperCase());
  if (!m) return false;
  const esperado = await licenseChecksum(m[1], m[2]);
  return esperado === m[3];
}

// Páginas públicas de política de privacidade, por app — usadas como URL
// oficial exigida pela Google Play Console (e por lojas de terceiros).
// Para lançar um app novo, basta adicionar uma entrada aqui.
const PRIVACY_PAGES = {
  'leuname-gestao': {
    nomeApp: 'LeuName Gestão',
    corpo: `
      <p><strong>Última atualização:</strong> 20 de setembro de 2026.</p>
      <p>O LeuName Gestão é um aplicativo de gestão empresarial (vendas,
      estoque, ordens de serviço, financeiro e relatórios) desenvolvido
      pela LeuName Softwares.</p>
      <h2>Onde ficam os seus dados</h2>
      <p>Todos os dados que você cadastra no LeuName Gestão — produtos,
      clientes, vendas, ordens de serviço, informações financeiras — ficam
      armazenados no seu próprio dispositivo, em um banco de dados local
      (IndexedDB), e o aplicativo funciona 100% offline: você pode usar o
      sistema inteiro sem internet.</p>
      <h2>Sincronização entre os seus dispositivos</h2>
      <p>Se você ativa a mesma chave de licença em mais de um dispositivo
      (por exemplo, celular e computador da mesma loja), o aplicativo
      envia os dados cadastrados para um servidor da LeuName Softwares
      (hospedado na Cloudflare), de forma automática e sempre que houver
      conexão com a internet, para que os demais dispositivos com a
      <strong>mesma chave de licença</strong> recebam essas mesmas
      informações. Esse envio é protegido por HTTPS (criptografado em
      trânsito) e os dados ficam associados apenas à sua chave de
      licença — a LeuName Softwares não acessa, analisa nem compartilha
      esses dados com terceiros, e eles não são usados para publicidade.
      Você pode solicitar a exclusão dos dados sincronizados da sua loja
      a qualquer momento pelo contato abaixo.</p>
      <h2>Ativação da licença</h2>
      <p>A chave de licença informada na ativação é validada localmente,
      dentro do próprio aplicativo, sem depender de internet para a
      primeira ativação.</p>
      <h2>Permissões do aplicativo</h2>
      <p>O aplicativo pode solicitar permissão de armazenamento apenas para
      salvar ou importar arquivos de backup que você mesmo escolher gerar
      (por exemplo, exportação de relatórios). Essa permissão não é usada
      para coletar ou transmitir dados a terceiros.</p>
      <h2>Compartilhamento de dados com terceiros</h2>
      <p>A LeuName Softwares não vende, não compartilha e não usa para
      publicidade nenhum dado cadastrado no aplicativo. Os dados
      sincronizados (ver seção acima) ficam apenas no servidor da
      LeuName Softwares, pelo tempo necessário para o funcionamento do
      sistema.</p>
      <h2>Backup em nuvem de terceiros (opcional)</h2>
      <p>Caso o usuário opte, dentro das configurações do aplicativo, por
      conectar um serviço de nuvem próprio (como Google Drive, OneDrive ou
      Dropbox) para backup adicional, esse envio é feito diretamente entre
      o dispositivo do usuário e o serviço de nuvem escolhido por ele,
      seguindo a política de privacidade do respectivo serviço.</p>
      <h2>Contato</h2>
      <p>Dúvidas sobre esta política, ou pedidos de exclusão de dados,
      podem ser enviados para
      <strong>contato@leunamesoftware.com</strong>.</p>
    `,
  },
  'construgestao': {
    nomeApp: 'ConstruGestão',
    corpo: `
      <p><strong>Última atualização:</strong> 22 de setembro de 2026.</p>
      <p>O ConstruGestão é um aplicativo de gestão empresarial (produtos,
      estoque, vendas, clientes, fornecedores, compras e relatórios) para
      lojas de material de construção, desenvolvido pela LeuName
      Softwares.</p>
      <h2>Onde ficam os seus dados</h2>
      <p>Todos os dados que você cadastra no ConstruGestão — produtos,
      categorias, clientes, vendas, fornecedores, informações financeiras
      — ficam armazenados no seu próprio dispositivo, em um banco de dados
      local (IndexedDB), e o aplicativo funciona 100% offline: você pode
      usar o sistema inteiro sem internet.</p>
      <h2>Sincronização entre os seus dispositivos</h2>
      <p>Se você ativa a mesma chave de licença em mais de um dispositivo
      (por exemplo, celular e computador da mesma loja), o aplicativo
      envia os dados cadastrados para um servidor da LeuName Softwares
      (hospedado na Cloudflare), de forma automática e sempre que houver
      conexão com a internet, para que os demais dispositivos com a
      <strong>mesma chave de licença</strong> recebam essas mesmas
      informações. Esse envio é protegido por HTTPS (criptografado em
      trânsito) e os dados ficam associados apenas à sua chave de
      licença — a LeuName Softwares não acessa, analisa nem compartilha
      esses dados com terceiros, e eles não são usados para publicidade.
      Você pode solicitar a exclusão dos dados sincronizados da sua loja
      a qualquer momento pelo contato abaixo.</p>
      <h2>Ativação da licença</h2>
      <p>A chave de licença informada na ativação é validada localmente,
      dentro do próprio aplicativo, sem depender de internet para a
      primeira ativação.</p>
      <h2>Permissões do aplicativo</h2>
      <p>O aplicativo pode solicitar permissão de câmera/galeria apenas
      para você anexar fotos de produtos ou categorias que você mesmo
      escolher enviar, e permissão de armazenamento para salvar ou
      importar arquivos de backup. Essas permissões não são usadas para
      coletar ou transmitir dados a terceiros.</p>
      <h2>Compartilhamento de dados com terceiros</h2>
      <p>A LeuName Softwares não vende, não compartilha e não usa para
      publicidade nenhum dado cadastrado no aplicativo. Os dados
      sincronizados (ver seção acima) ficam apenas no servidor da
      LeuName Softwares, pelo tempo necessário para o funcionamento do
      sistema.</p>
      <h2>Contato</h2>
      <p>Dúvidas sobre esta política, ou pedidos de exclusão de dados,
      podem ser enviados para
      <strong>contato@leunamesoftware.com</strong>.</p>
    `,
  },
};

function privacyPageHTML(app) {
  const title = `Política de Privacidade — ${app.nomeApp}`;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:720px;margin:0 auto;padding:32px 20px 80px;color:#1a2233;line-height:1.6;}
  h1{font-size:22px;} h2{font-size:17px;margin-top:28px;}
  p{font-size:15px;}
  footer{margin-top:48px;font-size:13px;color:#667;}
</style>
</head>
<body>
<h1>${title}</h1>
${app.corpo}
<footer>LeuName Softwares</footer>
</body>
</html>`;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    },
  });
}

function autenticado(request, env) {
  const auth = request.headers.get('Authorization') || '';
  return auth === `Bearer ${env.ADMIN_TOKEN}`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === 'OPTIONS') return json({});

    if (pathname === '/health') {
      return json({ ok: true, servico: 'leuname-licencas' });
    }

    // GET /download/<arquivo> — link fixo e permanente para o instalador
    // mais recente (ex.: /download/leuname-gestao.apk). O conteudo e
    // atualizado automaticamente pelos workflows de build a cada nova
    // versao; o link em si nunca muda, entao pode ser compartilhado com
    // clientes ou usado direto no navegador do celular/computador.
    if (pathname.startsWith('/download/') && request.method === 'GET') {
      const fileName = pathname.replace('/download/', '');
      const obj = await env.DOWNLOADS.get(fileName);
      if (!obj) return new Response('Arquivo não encontrado.', { status: 404 });
      const headers = new Headers();
      obj.writeHttpMetadata(headers);
      headers.set('Content-Disposition', `attachment; filename="${fileName}"`);
      headers.set('Cache-Control', 'no-cache');
      return new Response(obj.body, { headers });
    }

    // POST /sync/push — um dispositivo manda as alteracoes locais (desde a
    // ultima sincronizacao) pra guardar na nuvem. Autenticado pela propria
    // chave de licenca (nao precisa login/senha: quem tem a chave valida
    // do cliente pode ler/escrever os dados daquela loja).
    // Body: { chave, alteracoes: [{ store, id, payload, atualizado_em, deletado }] }
    if (pathname === '/sync/push' && request.method === 'POST') {
      const body = await request.json().catch(() => null);
      if (!body || !body.chave) return json({ ok: false, erro: 'chave_obrigatoria' }, 400);
      if (!(await chaveValida(body.chave))) return json({ ok: false, erro: 'chave_invalida' }, 401);
      const chave = body.chave.trim().toUpperCase();
      const alteracoes = Array.isArray(body.alteracoes) ? body.alteracoes.slice(0, 500) : [];
      if (alteracoes.length === 0) return json({ ok: true, salvos: 0 });

      const stmt = env.DB.prepare(
        `INSERT INTO sync_registros (chave, store, registro_id, payload, atualizado_em, deletado)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(chave, store, registro_id) DO UPDATE SET
           payload = excluded.payload,
           atualizado_em = excluded.atualizado_em,
           deletado = excluded.deletado
         WHERE excluded.atualizado_em > sync_registros.atualizado_em`
      );
      const batch = alteracoes
        .filter((a) => a && a.store && a.id && Number.isFinite(a.atualizado_em))
        .map((a) => stmt.bind(
          chave,
          String(a.store),
          String(a.id),
          a.deletado ? null : JSON.stringify(a.payload ?? null),
          a.atualizado_em,
          a.deletado ? 1 : 0,
        ));
      if (batch.length) await env.DB.batch(batch);
      return json({ ok: true, salvos: batch.length });
    }

    // GET /sync/pull?chave=...&desde=<epoch_ms> — devolve tudo que mudou
    // (de qualquer dispositivo) depois de "desde". O dispositivo aplica
    // essas mudancas no banco local e guarda o maior atualizado_em
    // recebido como novo cursor pra proxima chamada.
    if (pathname === '/sync/pull' && request.method === 'GET') {
      const chave = (url.searchParams.get('chave') || '').trim().toUpperCase();
      const desde = Number(url.searchParams.get('desde') || '0') || 0;
      if (!(await chaveValida(chave))) return json({ ok: false, erro: 'chave_invalida' }, 401);

      const { results } = await env.DB.prepare(
        `SELECT store, registro_id, payload, atualizado_em, deletado
         FROM sync_registros WHERE chave = ? AND atualizado_em > ?
         ORDER BY atualizado_em ASC LIMIT 5000`
      ).bind(chave, desde).all();

      const alteracoes = results.map((r) => ({
        store: r.store,
        id: r.registro_id,
        payload: r.deletado ? null : JSON.parse(r.payload),
        atualizado_em: r.atualizado_em,
        deletado: !!r.deletado,
      }));
      return json({ ok: true, alteracoes });
    }

    // GET /privacidade?app=leuname-gestao — página pública de política de
    // privacidade, usada como URL oficial no Google Play Console e em
    // lojas de terceiros. Reutilizável: para um app novo, basta adicionar
    // uma entrada em PRIVACY_PAGES acima.
    if (pathname === '/privacidade' && request.method === 'GET') {
      const appId = url.searchParams.get('app') || 'leuname-gestao';
      const app = PRIVACY_PAGES[appId];
      if (!app) return new Response('App não encontrado.', { status: 404 });
      return new Response(privacyPageHTML(app), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // ---- rotas administrativas (exigem o header Authorization: Bearer <ADMIN_TOKEN>) ----
    if (pathname.startsWith('/admin/')) {
      if (!autenticado(request, env)) {
        return json({ ok: false, erro: 'nao_autorizado' }, 401);
      }

      // POST /admin/apps  { id, nome }
      if (pathname === '/admin/apps' && request.method === 'POST') {
        const body = await request.json();
        if (!body.id || !body.nome) return json({ ok: false, erro: 'id_e_nome_obrigatorios' }, 400);
        await env.DB.prepare(
          'INSERT OR IGNORE INTO apps (id, nome, criado_em) VALUES (?, ?, datetime(\'now\'))'
        ).bind(body.id, body.nome).run();
        return json({ ok: true, app: body.id });
      }

      // GET /admin/apps
      if (pathname === '/admin/apps' && request.method === 'GET') {
        const { results } = await env.DB.prepare('SELECT * FROM apps ORDER BY criado_em').all();
        return json({ ok: true, apps: results });
      }

      // POST /admin/licencas/gerar  { app_id, cliente_nome, cliente_contato, origem, chave? }
      // Se "chave" vier preenchida, registra ESSA chave já existente (ex: uma
      // chave que já foi entregue ao cliente por fora) em vez de gerar uma
      // nova aleatória -- serve pra colocar nome em licenças antigas.
      if (pathname === '/admin/licencas/gerar' && request.method === 'POST') {
        const body = await request.json();
        const appId = body.app_id || 'leuname-gestao';
        const app = await env.DB.prepare('SELECT id FROM apps WHERE id = ?').bind(appId).first();
        if (!app) return json({ ok: false, erro: 'app_nao_encontrado' }, 404);

        let chave;
        if (body.chave) {
          chave = body.chave.trim().toUpperCase();
          if (!(await chaveValida(chave))) return json({ ok: false, erro: 'chave_invalida' }, 400);
          const existente = await env.DB.prepare('SELECT id FROM licencas WHERE chave = ?').bind(chave).first();
          if (existente) return json({ ok: false, erro: 'chave_ja_cadastrada' }, 409);
        } else {
          chave = await gerarChave();
        }

        const id = crypto.randomUUID();
        await env.DB.prepare(
          `INSERT INTO licencas (id, app_id, chave, cliente_nome, cliente_contato, origem, status, criado_em)
           VALUES (?, ?, ?, ?, ?, ?, 'ativa', datetime('now'))`
        ).bind(id, appId, chave, body.cliente_nome || null, body.cliente_contato || null, body.origem || 'manual').run();

        return json({ ok: true, chave, app_id: appId, id });
      }

      // GET /admin/licencas?app_id=leuname-gestao
      if (pathname === '/admin/licencas' && request.method === 'GET') {
        const appId = url.searchParams.get('app_id');
        const stmt = appId
          ? env.DB.prepare('SELECT * FROM licencas WHERE app_id = ? ORDER BY criado_em DESC').bind(appId)
          : env.DB.prepare('SELECT * FROM licencas ORDER BY criado_em DESC');
        const { results } = await stmt.all();
        return json({ ok: true, licencas: results });
      }

      // POST /admin/licencas/revogar  { chave }
      if (pathname === '/admin/licencas/revogar' && request.method === 'POST') {
        const body = await request.json();
        if (!body.chave) return json({ ok: false, erro: 'chave_obrigatoria' }, 400);
        await env.DB.prepare(
          "UPDATE licencas SET status = 'revogada', revogado_em = datetime('now') WHERE chave = ?"
        ).bind(body.chave).run();
        return json({ ok: true, chave: body.chave, status: 'revogada' });
      }

      // POST /admin/licencas/reativar  { chave }
      if (pathname === '/admin/licencas/reativar' && request.method === 'POST') {
        const body = await request.json();
        if (!body.chave) return json({ ok: false, erro: 'chave_obrigatoria' }, 400);
        await env.DB.prepare(
          "UPDATE licencas SET status = 'ativa', revogado_em = NULL WHERE chave = ?"
        ).bind(body.chave).run();
        return json({ ok: true, chave: body.chave, status: 'ativa' });
      }

      // POST /admin/licencas/excluir  { chave }  -- remove a linha de vez
      // (diferente de revogar: nao da pra desfazer, some da lista).
      if (pathname === '/admin/licencas/excluir' && request.method === 'POST') {
        const body = await request.json();
        if (!body.chave) return json({ ok: false, erro: 'chave_obrigatoria' }, 400);
        await env.DB.prepare('DELETE FROM licencas WHERE chave = ?').bind(body.chave).run();
        return json({ ok: true, chave: body.chave, status: 'excluida' });
      }

      return json({ ok: false, erro: 'rota_nao_encontrada' }, 404);
    }

    // GET /licencas/verificar?chave=LEU-XXXX-XXXX-XXXX  (publico -- so confirma se
    // essa chave foi emitida por nos e se continua ativa no nosso registro; o app
    // em si NAO chama isso hoje, e so pra suporte/consulta manual)
    if (pathname === '/licencas/verificar' && request.method === 'GET') {
      const chave = (url.searchParams.get('chave') || '').trim().toUpperCase();
      const row = await env.DB.prepare('SELECT app_id, status, criado_em FROM licencas WHERE chave = ?')
        .bind(chave).first();
      if (!row) return json({ ok: true, encontrada: false });
      return json({ ok: true, encontrada: true, ...row });
    }

    return json({ ok: false, erro: 'rota_nao_encontrada' }, 404);
  },
};
