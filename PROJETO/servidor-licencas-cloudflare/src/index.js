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

      // POST /admin/licencas/gerar  { app_id, cliente_nome, cliente_contato, origem }
      if (pathname === '/admin/licencas/gerar' && request.method === 'POST') {
        const body = await request.json();
        const appId = body.app_id || 'leuname-gestao';
        const app = await env.DB.prepare('SELECT id FROM apps WHERE id = ?').bind(appId).first();
        if (!app) return json({ ok: false, erro: 'app_nao_encontrado' }, 404);

        const chave = await gerarChave();
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
