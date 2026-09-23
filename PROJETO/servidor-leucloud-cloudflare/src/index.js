// LeuCloud — servidor (Cloudflare Worker + D1 + R2) — LeuName Softwares
//
// Fase 1 (MVP real): cadastro/login/recuperacao de senha, pastas, upload
// e download reais no R2, renomear/mover/copiar/excluir, lixeira, calculo
// de espaco usado, conta admin sem limite. Mesmo estilo de rota "flat"
// (if pathname === ... ) usado em servidor-licencas-cloudflare, mas com
// contas de usuario reais (senha com hash) em vez de chave de licenca.
//
// NAO enviamos e-mail de verdade ainda (recuperacao de senha gera o
// token no banco, mas a ENTREGA por e-mail depende de escolher um
// provedor -- ver comentario na rota /auth/recuperar-senha). NAO
// declarar "criptografia ponta a ponta" em lugar nenhum: os arquivos
// sao protegidos em transito (HTTPS) e em repouso pelo proprio R2, mas
// o servidor tem acesso as chaves/objetos -- isso NAO e E2E.

const SESSION_DIAS = 30;
const LIXEIRA_DIAS = 30;
// O WebCrypto do Cloudflare Workers rejeita PBKDF2 acima de 100000
// iteracoes ("iteration counts above 100000 are not supported") -- esse
// e o maximo permitido nesse runtime, entao usamos exatamente esse valor.
const PBKDF2_ITERACOES = 100000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-File-Name, X-Folder-Id',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    },
  });
}

function uid() { return crypto.randomUUID(); }
function nowIso() { return new Date().toISOString(); }

function bufToB64(buf) {
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64ToBuf(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function bufToHex(buf) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function sha256Hex(texto) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return bufToHex(digest);
}
function tokenAleatorio() {
  return bufToHex(crypto.getRandomValues(new Uint8Array(32)));
}

// ---- senha: PBKDF2 com salt por usuario + "pepper" secreto do servidor ----
// bcrypt/Argon2 nao existem no runtime do Workers; PBKDF2 via WebCrypto e
// o metodo correto disponivel aqui, com iteracoes altas.
async function hashSenha(senha, env, iterations = PBKDF2_ITERACOES) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(senha + env.PASSWORD_PEPPER), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, material, 256);
  return { hash: bufToB64(bits), salt: bufToB64(salt), iterations };
}
async function verificarSenha(senha, saltB64, hashB64, iterations, env) {
  const salt = b64ToBuf(saltB64);
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(senha + env.PASSWORD_PEPPER), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, material, 256);
  return bufToB64(bits) === hashB64;
}

async function logAtividade(env, userId, action, targetType, targetId, request, metadata) {
  await env.DB.prepare(
    `INSERT INTO activity_logs (id, user_id, action, target_type, target_id, ip, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(uid(), userId, action, targetType || null, targetId || null,
    request.headers.get('CF-Connecting-IP') || null, metadata ? JSON.stringify(metadata) : null, nowIso()).run();
}

// Limite basico de tentativas: no maximo 10 tentativas de um mesmo
// identificador (e-mail ou IP) numa janela de 15 minutos, por tipo de
// acao. Protecao obrigatoria desde a Fase 1, nao e opcional.
async function limiteExcedido(env, identifier, kind, maxTentativas = 10) {
  const desde = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const row = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM auth_attempts WHERE identifier = ? AND kind = ? AND created_at > ?'
  ).bind(identifier, kind, desde).first();
  return (row?.n || 0) >= maxTentativas;
}
async function registrarTentativa(env, identifier, kind, succeeded) {
  await env.DB.prepare(
    'INSERT INTO auth_attempts (id, identifier, kind, succeeded, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(uid(), identifier, kind, succeeded ? 1 : 0, nowIso()).run();
}

function quotaBytes(user) {
  if (user.is_admin_unlimited) return null; // null = sem limite
  return user.storage_quota_override_bytes ?? user.plan_storage_bytes;
}

// Sessao: token opaco aleatorio devolvido ao cliente; so o HASH dele fica
// no banco. Revogar = apagar/marcar a linha -- efeito imediato de
// verdade, diferente de um JWT que so expira sozinho.
async function autenticar(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return null;
  const hash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT s.id AS session_id, s.device_id, u.* , p.storage_bytes AS plan_storage_bytes
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     JOIN plans p ON p.id = u.plan_id
     WHERE s.session_token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?`
  ).bind(hash, nowIso()).first();
  if (!row) return null;
  await env.DB.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').bind(nowIso(), row.session_id).run();
  if (row.device_id) await env.DB.prepare('UPDATE devices SET last_seen_at = ? WHERE id = ?').bind(nowIso(), row.device_id).run();
  return { user: row, sessionId: row.session_id, deviceId: row.device_id };
}

function categoriaDoMime(mime) {
  if (!mime) return 'outro';
  if (mime.startsWith('image/')) return 'foto';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf' || mime.startsWith('text/') || mime.includes('document') || mime.includes('sheet')) return 'documento';
  return 'outro';
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const method = request.method;

    if (method === 'OPTIONS') return json({});
    if (pathname === '/health') return json({ ok: true, servico: 'leucloud-api' });

    // ---- publico: planos ----
    if (pathname === '/billing/planos' && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM plans WHERE is_active = 1 ORDER BY sort_order').all();
      return json({ ok: true, planos: results });
    }

    // ==================== AUTENTICACAO ====================

    if (pathname === '/auth/signup' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const email = (body.email || '').trim().toLowerCase();
      const nome = (body.name || '').trim();
      const senha = body.password || '';
      if (!email || !email.includes('@') || !nome || senha.length < 8) {
        return json({ ok: false, erro: 'dados_invalidos' }, 400);
      }
      const ip = request.headers.get('CF-Connecting-IP') || 'sem-ip';
      if (await limiteExcedido(env, ip, 'signup')) return json({ ok: false, erro: 'muitas_tentativas' }, 429);
      await registrarTentativa(env, ip, 'signup', true);

      const existente = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
      if (existente) return json({ ok: false, erro: 'email_ja_cadastrado' }, 409);

      const { hash, salt, iterations } = await hashSenha(senha, env);
      const userId = uid();
      const agora = nowIso();
      await env.DB.prepare(
        `INSERT INTO users (id, name, email, password_hash, password_salt, password_iterations, plan_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'gratis', ?, ?)`
      ).bind(userId, nome, email, hash, salt, iterations, agora, agora).run();

      const { sessionToken, deviceId } = await criarSessao(env, userId, body.platform || 'web', body.device_name || null, request);
      await logAtividade(env, userId, 'signup', 'user', userId, request);
      return json({ ok: true, session_token: sessionToken, device_id: deviceId, user: await perfilPublico(env, userId) });
    }

    if (pathname === '/auth/login' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const email = (body.email || '').trim().toLowerCase();
      const senha = body.password || '';
      if (await limiteExcedido(env, email || 'sem-email', 'login')) return json({ ok: false, erro: 'muitas_tentativas' }, 429);

      const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
      const ok = user ? await verificarSenha(senha, user.password_salt, user.password_hash, user.password_iterations, env) : false;
      await registrarTentativa(env, email || 'sem-email', 'login', ok);
      if (!user || !ok || user.status !== 'ativo') return json({ ok: false, erro: 'credenciais_invalidas' }, 401);

      // Senha certa, mas a conta tem 2FA -- ainda nao cria sessao. Devolve
      // um token temporario (uso unico, 5 min) que o app troca pelo
      // codigo TOTP em /auth/login/2fa.
      if (user.two_factor_enabled) {
        const tempToken = tokenAleatorio();
        const tempHash = await sha256Hex(tempToken);
        const expira = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        await env.DB.prepare(
          `INSERT INTO auth_tokens (id, user_id, purpose, token_hash, expires_at, requested_ip, created_at)
           VALUES (?, ?, '2fa_login', ?, ?, ?, ?)`
        ).bind(uid(), user.id, tempHash, expira, request.headers.get('CF-Connecting-IP') || null, nowIso()).run();
        return json({ ok: true, requer_2fa: true, temp_token: tempToken, plataforma: body.platform || 'web', device_name: body.device_name || null });
      }

      const { sessionToken, deviceId } = await criarSessao(env, user.id, body.platform || 'web', body.device_name || null, request);
      await env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').bind(nowIso(), user.id).run();
      await logAtividade(env, user.id, 'login', 'user', user.id, request);
      return json({ ok: true, session_token: sessionToken, device_id: deviceId, user: await perfilPublico(env, user.id) });
    }

    if (pathname === '/auth/login/2fa' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const tempToken = body.temp_token || '';
      const codigo = (body.code || '').trim();
      if (!tempToken || !codigo) return json({ ok: false, erro: 'dados_invalidos' }, 400);
      const tempHash = await sha256Hex(tempToken);
      const row = await env.DB.prepare(
        `SELECT * FROM auth_tokens WHERE token_hash = ? AND purpose = '2fa_login' AND used_at IS NULL AND expires_at > ?`
      ).bind(tempHash, nowIso()).first();
      if (!row) return json({ ok: false, erro: 'token_invalido_ou_expirado' }, 400);
      const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(row.user_id).first();
      if (!user || !user.two_factor_secret || !(await verificarTotp(user.two_factor_secret, codigo))) {
        return json({ ok: false, erro: 'codigo_invalido' }, 401);
      }
      await env.DB.prepare('UPDATE auth_tokens SET used_at = ? WHERE id = ?').bind(nowIso(), row.id).run();
      const { sessionToken, deviceId } = await criarSessao(env, user.id, body.platform || 'web', body.device_name || null, request);
      await env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').bind(nowIso(), user.id).run();
      await logAtividade(env, user.id, 'login_2fa', 'user', user.id, request);
      return json({ ok: true, session_token: sessionToken, device_id: deviceId, user: await perfilPublico(env, user.id) });
    }

    if (pathname === '/auth/logout' && method === 'POST') {
      const auth = await autenticar(request, env);
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      await env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ?').bind(nowIso(), auth.sessionId).run();
      return json({ ok: true });
    }

    // Gera o token de redefinicao e guarda so o HASH dele no banco. A
    // ENTREGA por e-mail ainda nao esta ligada (falta escolher um
    // provedor, ex: Resend/Mailgun/SES) -- ate isso existir, essa rota
    // fica "pronta mas sem efeito pratico" para quem esquece a senha de
    // verdade. Nunca devolver o token cru na resposta (isso quebraria a
    // seguranca do fluxo).
    if (pathname === '/auth/recuperar-senha' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const email = (body.email || '').trim().toLowerCase();
      const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
      if (user) {
        const token = tokenAleatorio();
        const tokenHash = await sha256Hex(token);
        const expira = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        await env.DB.prepare(
          `INSERT INTO auth_tokens (id, user_id, purpose, token_hash, expires_at, requested_ip, created_at)
           VALUES (?, ?, 'password_reset', ?, ?, ?, ?)`
        ).bind(uid(), user.id, tokenHash, expira, request.headers.get('CF-Connecting-IP') || null, nowIso()).run();
        // TODO(Fase 1, pendente de provedor de e-mail): enviar `token` pro
        // e-mail do usuario. Por enquanto o token so existe no banco.
      }
      // Resposta igual exista ou nao o e-mail, pra nao revelar quem tem conta.
      return json({ ok: true, mensagem: 'Se o e-mail existir, enviaremos as instruções.' });
    }

    if (pathname === '/auth/redefinir-senha' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const token = body.token || '';
      const novaSenha = body.new_password || '';
      if (!token || novaSenha.length < 8) return json({ ok: false, erro: 'dados_invalidos' }, 400);
      const tokenHash = await sha256Hex(token);
      const row = await env.DB.prepare(
        `SELECT * FROM auth_tokens WHERE token_hash = ? AND purpose = 'password_reset' AND used_at IS NULL AND expires_at > ?`
      ).bind(tokenHash, nowIso()).first();
      if (!row) return json({ ok: false, erro: 'token_invalido_ou_expirado' }, 400);

      const { hash, salt, iterations } = await hashSenha(novaSenha, env);
      await env.DB.prepare('UPDATE users SET password_hash=?, password_salt=?, password_iterations=?, updated_at=? WHERE id=?')
        .bind(hash, salt, iterations, nowIso(), row.user_id).run();
      await env.DB.prepare('UPDATE auth_tokens SET used_at = ? WHERE id = ?').bind(nowIso(), row.id).run();
      // Redefinir a senha revoga todas as sessoes existentes -- se alguem
      // roubou a conta, essa troca de senha tira o invasor na hora.
      await env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').bind(nowIso(), row.user_id).run();
      await logAtividade(env, row.user_id, 'password_reset', 'user', row.user_id, request);
      return json({ ok: true });
    }

    // ---- a partir daqui, todas as rotas exigem sessao valida ----
    const auth = await autenticar(request, env);

    if (pathname === '/me' && method === 'GET') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      return json({ ok: true, user: await perfilPublico(env, auth.user.id) });
    }

    if (pathname === '/me' && method === 'PATCH') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const body = await request.json().catch(() => ({}));
      const nome = (body.name || '').trim();
      if (!nome) return json({ ok: false, erro: 'nome_obrigatorio' }, 400);
      await env.DB.prepare('UPDATE users SET name = ?, updated_at = ? WHERE id = ?').bind(nome, nowIso(), auth.user.id).run();
      return json({ ok: true, user: await perfilPublico(env, auth.user.id) });
    }

    // Gera um segredo TOTP novo (ainda NAO ativado -- so vira efetivo depois
    // de confirmar um codigo valido em /me/2fa/confirmar). Repetir essa
    // chamada troca o segredo pendente, sem afetar 2FA ja ativo.
    if (pathname === '/me/2fa/iniciar' && method === 'POST') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const secret = base32Encode(crypto.getRandomValues(new Uint8Array(20)));
      await env.DB.prepare('UPDATE users SET two_factor_secret = ?, updated_at = ? WHERE id = ?').bind(secret, nowIso(), auth.user.id).run();
      const otpauth = `otpauth://totp/LeuCloud:${encodeURIComponent(auth.user.email)}?secret=${secret}&issuer=LeuCloud&algorithm=SHA1&digits=6&period=30`;
      return json({ ok: true, secret, otpauth_uri: otpauth });
    }

    if (pathname === '/me/2fa/confirmar' && method === 'POST') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const body = await request.json().catch(() => ({}));
      const linha = await env.DB.prepare('SELECT two_factor_secret FROM users WHERE id = ?').bind(auth.user.id).first();
      if (!linha || !linha.two_factor_secret) return json({ ok: false, erro: '2fa_nao_iniciado' }, 400);
      if (!(await verificarTotp(linha.two_factor_secret, (body.code || '').trim()))) return json({ ok: false, erro: 'codigo_invalido' }, 401);
      await env.DB.prepare('UPDATE users SET two_factor_enabled = 1, updated_at = ? WHERE id = ?').bind(nowIso(), auth.user.id).run();
      await logAtividade(env, auth.user.id, '2fa_enabled', 'user', auth.user.id, request);
      return json({ ok: true });
    }

    // Desativar exige a senha (nao o codigo TOTP) -- se a pessoa perdeu o
    // celular com o app autenticador mas ainda sabe a senha, precisa
    // conseguir desligar o 2FA mesmo assim.
    if (pathname === '/me/2fa/desativar' && method === 'POST') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const body = await request.json().catch(() => ({}));
      const ok = await verificarSenha(body.current_password || '', auth.user.password_salt, auth.user.password_hash, auth.user.password_iterations, env);
      if (!ok) return json({ ok: false, erro: 'senha_atual_incorreta' }, 401);
      await env.DB.prepare('UPDATE users SET two_factor_enabled = 0, two_factor_secret = NULL, updated_at = ? WHERE id = ?').bind(nowIso(), auth.user.id).run();
      await logAtividade(env, auth.user.id, '2fa_disabled', 'user', auth.user.id, request);
      return json({ ok: true });
    }

    if (pathname === '/me/senha' && method === 'PATCH') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const body = await request.json().catch(() => ({}));
      const ok = await verificarSenha(body.current_password || '', auth.user.password_salt, auth.user.password_hash, auth.user.password_iterations, env);
      if (!ok) return json({ ok: false, erro: 'senha_atual_incorreta' }, 401);
      if ((body.new_password || '').length < 8) return json({ ok: false, erro: 'senha_nova_curta' }, 400);
      const { hash, salt, iterations } = await hashSenha(body.new_password, env);
      await env.DB.prepare('UPDATE users SET password_hash=?, password_salt=?, password_iterations=?, updated_at=? WHERE id=?')
        .bind(hash, salt, iterations, nowIso(), auth.user.id).run();
      await logAtividade(env, auth.user.id, 'password_change', 'user', auth.user.id, request);
      return json({ ok: true });
    }

    // Foto de perfil: guardada separada do espaco do plano (nao conta
    // como "arquivo" do usuario, so 1 objeto por conta, sempre sobrescrito).
    if (pathname === '/me/avatar' && method === 'POST') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const mime = request.headers.get('Content-Type') || '';
      if (!mime.startsWith('image/')) return json({ ok: false, erro: 'tipo_invalido' }, 400);
      const tamanho = Number(request.headers.get('Content-Length') || 0);
      if (!tamanho || tamanho > 5 * 1024 * 1024) return json({ ok: false, erro: 'imagem_muito_grande' }, 413);
      const key = `avatars/${auth.user.id}`;
      await env.ARQUIVOS.put(key, request.body, { httpMetadata: { contentType: mime } });
      await env.DB.prepare('UPDATE users SET avatar_r2_key = ?, updated_at = ? WHERE id = ?').bind(key, nowIso(), auth.user.id).run();
      return json({ ok: true });
    }

    // Publica (sem auth) de proposito: e so uma foto de perfil, nao um
    // arquivo privado -- assim a tela pode usar <img src> direto, sem
    // precisar buscar com token e montar blob URL.
    let m = pathname.match(/^\/avatar\/([^/]+)$/);
    if (m && method === 'GET') {
      const row = await env.DB.prepare('SELECT avatar_r2_key FROM users WHERE id = ?').bind(m[1]).first();
      if (!row || !row.avatar_r2_key) return json({ ok: false, erro: 'sem_avatar' }, 404);
      const objeto = await env.ARQUIVOS.get(row.avatar_r2_key);
      if (!objeto) return json({ ok: false, erro: 'nao_encontrado' }, 404);
      const headers = new Headers();
      objeto.writeHttpMetadata(headers);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Cache-Control', 'public, max-age=300');
      return new Response(objeto.body, { headers });
    }

    // ==================== PASTAS ====================

    if (pathname === '/folders' && method === 'POST') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const body = await request.json().catch(() => ({}));
      const nome = (body.name || '').trim();
      const parentId = body.parent_id || null;
      if (!nome) return json({ ok: false, erro: 'nome_obrigatorio' }, 400);
      const duplicada = await env.DB.prepare(
        `SELECT id FROM folders WHERE user_id = ? AND is_deleted = 0 AND name = ? AND (parent_id = ? OR (parent_id IS NULL AND ? IS NULL))`
      ).bind(auth.user.id, nome, parentId, parentId).first();
      if (duplicada) return json({ ok: false, erro: 'ja_existe_pasta_com_esse_nome' }, 409);
      const id = uid();
      const agora = nowIso();
      await env.DB.prepare(
        `INSERT INTO folders (id, user_id, parent_id, name, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM folders WHERE user_id = ? AND is_deleted = 0 AND (parent_id = ? OR (parent_id IS NULL AND ? IS NULL))), ?, ?)`
      ).bind(id, auth.user.id, parentId, nome, auth.user.id, parentId, parentId, agora, agora).run();
      return json({ ok: true, folder: { id, name: nome, parent_id: parentId } });
    }

    // GET /folders/:id  (":id" = "root" para a raiz) -- lista subpastas e arquivos.
    // Tambem atende quem recebeu essa pasta por compartilhamento direto
    // (share_recipients), mesmo que a pasta pertenca a outra conta --
    // resolverAcessoPasta sobe a arvore de pais procurando um convite.
    m = pathname.match(/^\/folders\/([^/]+)$/);
    if (m && method === 'GET') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const folderId = m[1] === 'root' ? null : m[1];
      let ownerId = auth.user.id;
      if (folderId !== null) {
        const acesso = await resolverAcessoPasta(env, folderId, auth.user.id);
        if (!acesso) return json({ ok: false, erro: 'nao_encontrada' }, 404);
        ownerId = acesso.ownerId;
      }
      const subpastas = await env.DB.prepare(
        `SELECT id, name, is_favorite, sort_order, created_at, updated_at FROM folders
         WHERE user_id = ? AND is_deleted = 0 AND (parent_id = ? OR (parent_id IS NULL AND ? IS NULL))
         ORDER BY sort_order, name COLLATE NOCASE`
      ).bind(ownerId, folderId, folderId).all();
      const arquivos = await env.DB.prepare(
        `SELECT id, name, mime_type, size_bytes, category, is_favorite, sort_order, created_at, updated_at FROM files
         WHERE user_id = ? AND is_deleted = 0 AND (folder_id = ? OR (folder_id IS NULL AND ? IS NULL))
         ORDER BY sort_order, name COLLATE NOCASE`
      ).bind(ownerId, folderId, folderId).all();
      return json({ ok: true, folders: subpastas.results, files: arquivos.results, compartilhada_por_outro: ownerId !== auth.user.id });
    }

    if (m && method === 'PATCH') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const folderId = m[1];
      const dono = await env.DB.prepare('SELECT id FROM folders WHERE id = ? AND user_id = ?').bind(folderId, auth.user.id).first();
      if (!dono) return json({ ok: false, erro: 'nao_encontrada' }, 404);
      const body = await request.json().catch(() => ({}));
      if (body.name) await env.DB.prepare('UPDATE folders SET name = ?, updated_at = ? WHERE id = ?').bind(body.name.trim(), nowIso(), folderId).run();
      if (body.parent_id !== undefined) await env.DB.prepare('UPDATE folders SET parent_id = ?, updated_at = ? WHERE id = ?').bind(body.parent_id, nowIso(), folderId).run();
      return json({ ok: true });
    }

    if (m && method === 'DELETE') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      await excluirPastaRecursivo(env, m[1], auth.user.id);
      await logAtividade(env, auth.user.id, 'folder_delete', 'folder', m[1], request);
      return json({ ok: true });
    }

    m = pathname.match(/^\/folders\/([^/]+)\/restaurar$/);
    if (m && method === 'POST') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      await restaurarPastaRecursivo(env, m[1], auth.user.id);
      return json({ ok: true });
    }

    m = pathname.match(/^\/folders\/([^/]+)\/favorito$/);
    if (m && method === 'POST') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const body = await request.json().catch(() => ({}));
      await env.DB.prepare('UPDATE folders SET is_favorite = ? WHERE id = ? AND user_id = ?')
        .bind(body.favorite ? 1 : 0, m[1], auth.user.id).run();
      return json({ ok: true });
    }

    // Reordenar na mao: troca a posicao (sort_order) com a pasta vizinha
    // (mesma pasta-pai) na direcao pedida. Se ja estiver na ponta, nao faz nada.
    m = pathname.match(/^\/folders\/([^/]+)\/mover$/);
    if (m && method === 'POST') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const body = await request.json().catch(() => ({}));
      const item = await env.DB.prepare('SELECT parent_id, sort_order FROM folders WHERE id = ? AND user_id = ? AND is_deleted = 0').bind(m[1], auth.user.id).first();
      if (!item) return json({ ok: false, erro: 'nao_encontrada' }, 404);
      const subindo = body.direcao === 'cima';
      const vizinho = await env.DB.prepare(
        `SELECT id, sort_order FROM folders WHERE user_id = ? AND is_deleted = 0 AND (parent_id = ? OR (parent_id IS NULL AND ? IS NULL))
         AND sort_order ${subindo ? '<' : '>'} ? ORDER BY sort_order ${subindo ? 'DESC' : 'ASC'} LIMIT 1`
      ).bind(auth.user.id, item.parent_id, item.parent_id, item.sort_order).first();
      if (!vizinho) return json({ ok: true, moveu: false });
      await env.DB.batch([
        env.DB.prepare('UPDATE folders SET sort_order = ? WHERE id = ?').bind(vizinho.sort_order, m[1]),
        env.DB.prepare('UPDATE folders SET sort_order = ? WHERE id = ?').bind(item.sort_order, vizinho.id),
      ]);
      return json({ ok: true, moveu: true });
    }

    // ==================== ARQUIVOS ====================

    if (pathname === '/files/upload' && method === 'POST') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const nomeArquivo = request.headers.get('X-File-Name');
      const folderId = request.headers.get('X-Folder-Id') || null;
      const tamanho = Number(request.headers.get('Content-Length') || 0);
      if (!nomeArquivo || !tamanho) return json({ ok: false, erro: 'cabecalhos_obrigatorios_ausentes' }, 400);

      const limite = quotaBytes(auth.user);
      if (limite !== null && auth.user.storage_used_bytes + tamanho > limite) {
        return json({ ok: false, erro: 'espaco_insuficiente' }, 413);
      }

      const fileId = uid();
      const mime = request.headers.get('Content-Type') || 'application/octet-stream';
      const r2Key = `users/${auth.user.id}/${fileId}/v1`;
      await env.ARQUIVOS.put(r2Key, request.body, { httpMetadata: { contentType: mime } });

      const agora = nowIso();
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO files (id, user_id, folder_id, name, mime_type, size_bytes, r2_key, category, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM files WHERE user_id = ? AND is_deleted = 0 AND (folder_id = ? OR (folder_id IS NULL AND ? IS NULL))), ?, ?)`
        ).bind(fileId, auth.user.id, folderId, nomeArquivo, mime, tamanho, r2Key, categoriaDoMime(mime), auth.user.id, folderId, folderId, agora, agora),
        env.DB.prepare('UPDATE users SET storage_used_bytes = storage_used_bytes + ? WHERE id = ?').bind(tamanho, auth.user.id),
      ]);
      await logAtividade(env, auth.user.id, 'upload', 'file', fileId, request, { size_bytes: tamanho });
      return json({ ok: true, file: { id: fileId, name: nomeArquivo, size_bytes: tamanho, mime_type: mime } });
    }

    m = pathname.match(/^\/files\/([^/]+)\/download$/);
    if (m && method === 'GET') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      let arq = await env.DB.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND is_deleted = 0').bind(m[1], auth.user.id).first();
      if (!arq) arq = await arquivoViaCompartilhamento(env, m[1], auth.user.id);
      if (!arq) return json({ ok: false, erro: 'nao_encontrado' }, 404);
      const objeto = await env.ARQUIVOS.get(arq.r2_key);
      if (!objeto) return json({ ok: false, erro: 'arquivo_perdido_no_armazenamento' }, 500);
      const headers = new Headers();
      objeto.writeHttpMetadata(headers);
      headers.set('Content-Disposition', `attachment; filename="${arq.name.replace(/"/g, '')}"`);
      headers.set('Access-Control-Allow-Origin', '*');
      return new Response(objeto.body, { headers });
    }

    m = pathname.match(/^\/files\/([^/]+)$/);
    if (m && method === 'PATCH') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const dono = await env.DB.prepare('SELECT id FROM files WHERE id = ? AND user_id = ?').bind(m[1], auth.user.id).first();
      if (!dono) return json({ ok: false, erro: 'nao_encontrado' }, 404);
      const body = await request.json().catch(() => ({}));
      if (body.name) await env.DB.prepare('UPDATE files SET name = ?, updated_at = ? WHERE id = ?').bind(body.name.trim(), nowIso(), m[1]).run();
      if (body.folder_id !== undefined) await env.DB.prepare('UPDATE files SET folder_id = ?, updated_at = ? WHERE id = ?').bind(body.folder_id, nowIso(), m[1]).run();
      if (body.favorite !== undefined) await env.DB.prepare('UPDATE files SET is_favorite = ? WHERE id = ?').bind(body.favorite ? 1 : 0, m[1]).run();
      return json({ ok: true });
    }

    if (m && method === 'DELETE') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const r = await env.DB.prepare('UPDATE files SET is_deleted = 1, deleted_at = ? WHERE id = ? AND user_id = ? AND is_deleted = 0')
        .bind(nowIso(), m[1], auth.user.id).run();
      if (!r.meta.rows_written) return json({ ok: false, erro: 'nao_encontrado' }, 404);
      await logAtividade(env, auth.user.id, 'file_delete', 'file', m[1], request);
      return json({ ok: true });
    }

    m = pathname.match(/^\/files\/([^/]+)\/restaurar$/);
    if (m && method === 'POST') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      await env.DB.prepare('UPDATE files SET is_deleted = 0, deleted_at = NULL WHERE id = ? AND user_id = ?').bind(m[1], auth.user.id).run();
      return json({ ok: true });
    }

    m = pathname.match(/^\/files\/([^/]+)\/copiar$/);
    if (m && method === 'POST') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const arq = await env.DB.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND is_deleted = 0').bind(m[1], auth.user.id).first();
      if (!arq) return json({ ok: false, erro: 'nao_encontrado' }, 404);
      const limite = quotaBytes(auth.user);
      if (limite !== null && auth.user.storage_used_bytes + arq.size_bytes > limite) return json({ ok: false, erro: 'espaco_insuficiente' }, 413);
      const objeto = await env.ARQUIVOS.get(arq.r2_key);
      if (!objeto) return json({ ok: false, erro: 'arquivo_perdido_no_armazenamento' }, 500);
      const novoId = uid();
      const novaChave = `users/${auth.user.id}/${novoId}/v1`;
      await env.ARQUIVOS.put(novaChave, objeto.body, { httpMetadata: { contentType: arq.mime_type } });
      const agora = nowIso();
      const body = await request.json().catch(() => ({}));
      const folderIdCopia = body.folder_id ?? arq.folder_id;
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO files (id, user_id, folder_id, name, mime_type, size_bytes, r2_key, category, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM files WHERE user_id = ? AND is_deleted = 0 AND (folder_id = ? OR (folder_id IS NULL AND ? IS NULL))), ?, ?)`
        ).bind(novoId, auth.user.id, folderIdCopia, `Cópia de ${arq.name}`, arq.mime_type, arq.size_bytes, novaChave, arq.category, auth.user.id, folderIdCopia, folderIdCopia, agora, agora),
        env.DB.prepare('UPDATE users SET storage_used_bytes = storage_used_bytes + ? WHERE id = ?').bind(arq.size_bytes, auth.user.id),
      ]);
      return json({ ok: true, file: { id: novoId } });
    }

    // Reordenar na mao: troca a posicao (sort_order) com o arquivo vizinho
    // (mesma pasta) na direcao pedida. Se ja estiver na ponta, nao faz nada.
    m = pathname.match(/^\/files\/([^/]+)\/mover$/);
    if (m && method === 'POST') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const body = await request.json().catch(() => ({}));
      const item = await env.DB.prepare('SELECT folder_id, sort_order FROM files WHERE id = ? AND user_id = ? AND is_deleted = 0').bind(m[1], auth.user.id).first();
      if (!item) return json({ ok: false, erro: 'nao_encontrado' }, 404);
      const subindo = body.direcao === 'cima';
      const vizinho = await env.DB.prepare(
        `SELECT id, sort_order FROM files WHERE user_id = ? AND is_deleted = 0 AND (folder_id = ? OR (folder_id IS NULL AND ? IS NULL))
         AND sort_order ${subindo ? '<' : '>'} ? ORDER BY sort_order ${subindo ? 'DESC' : 'ASC'} LIMIT 1`
      ).bind(auth.user.id, item.folder_id, item.folder_id, item.sort_order).first();
      if (!vizinho) return json({ ok: true, moveu: false });
      await env.DB.batch([
        env.DB.prepare('UPDATE files SET sort_order = ? WHERE id = ?').bind(vizinho.sort_order, m[1]),
        env.DB.prepare('UPDATE files SET sort_order = ? WHERE id = ?').bind(item.sort_order, vizinho.id),
      ]);
      return json({ ok: true, moveu: true });
    }

    // Envia um novo conteudo para um arquivo JA EXISTENTE, guardando a
    // versao anterior em file_versions (nunca sobrescreve sem historico).
    // O objeto antigo continua no R2 (agora "historico"); o novo vira o
    // r2_key atual do arquivo.
    m = pathname.match(/^\/files\/([^/]+)\/nova-versao$/);
    if (m && method === 'POST') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const arq = await env.DB.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND is_deleted = 0').bind(m[1], auth.user.id).first();
      if (!arq) return json({ ok: false, erro: 'nao_encontrado' }, 404);
      const tamanhoNovo = Number(request.headers.get('Content-Length') || 0);
      if (!tamanhoNovo) return json({ ok: false, erro: 'cabecalhos_obrigatorios_ausentes' }, 400);
      const limite = quotaBytes(auth.user);
      const delta = tamanhoNovo - arq.size_bytes;
      if (limite !== null && delta > 0 && auth.user.storage_used_bytes + delta > limite) return json({ ok: false, erro: 'espaco_insuficiente' }, 413);

      const novaVersao = arq.current_version + 1;
      const mime = request.headers.get('Content-Type') || arq.mime_type || 'application/octet-stream';
      const novaChave = `users/${auth.user.id}/${arq.id}/v${novaVersao}`;
      await env.ARQUIVOS.put(novaChave, request.body, { httpMetadata: { contentType: mime } });

      const agora = nowIso();
      await env.DB.batch([
        env.DB.prepare(
          'INSERT INTO file_versions (id, file_id, version_number, r2_key, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(uid(), arq.id, arq.current_version, arq.r2_key, arq.size_bytes, agora),
        env.DB.prepare(
          'UPDATE files SET r2_key = ?, size_bytes = ?, mime_type = ?, category = ?, current_version = ?, updated_at = ? WHERE id = ?'
        ).bind(novaChave, tamanhoNovo, mime, categoriaDoMime(mime), novaVersao, agora, arq.id),
        env.DB.prepare('UPDATE users SET storage_used_bytes = MAX(0, storage_used_bytes + ?) WHERE id = ?').bind(delta, auth.user.id),
      ]);
      await logAtividade(env, auth.user.id, 'file_new_version', 'file', arq.id, request, { version: novaVersao });
      return json({ ok: true, version: novaVersao });
    }

    m = pathname.match(/^\/files\/([^/]+)\/versoes$/);
    if (m && method === 'GET') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const arq = await env.DB.prepare('SELECT id, current_version, size_bytes, updated_at FROM files WHERE id = ? AND user_id = ?').bind(m[1], auth.user.id).first();
      if (!arq) return json({ ok: false, erro: 'nao_encontrado' }, 404);
      const { results } = await env.DB.prepare(
        'SELECT version_number, size_bytes, created_at FROM file_versions WHERE file_id = ? ORDER BY version_number DESC'
      ).bind(m[1]).all();
      return json({ ok: true, versao_atual: { version_number: arq.current_version, size_bytes: arq.size_bytes, created_at: arq.updated_at }, anteriores: results });
    }

    m = pathname.match(/^\/files\/([^/]+)\/versoes\/(\d+)\/download$/);
    if (m && method === 'GET') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const arq = await env.DB.prepare('SELECT name, user_id FROM files WHERE id = ? AND user_id = ?').bind(m[1], auth.user.id).first();
      if (!arq) return json({ ok: false, erro: 'nao_encontrado' }, 404);
      const versao = await env.DB.prepare('SELECT r2_key FROM file_versions WHERE file_id = ? AND version_number = ?').bind(m[1], Number(m[2])).first();
      if (!versao) return json({ ok: false, erro: 'versao_nao_encontrada' }, 404);
      const objeto = await env.ARQUIVOS.get(versao.r2_key);
      if (!objeto) return json({ ok: false, erro: 'arquivo_perdido_no_armazenamento' }, 500);
      const headers = new Headers();
      objeto.writeHttpMetadata(headers);
      headers.set('Content-Disposition', `attachment; filename="v${m[2]}-${arq.name.replace(/"/g, '')}"`);
      headers.set('Access-Control-Allow-Origin', '*');
      return new Response(objeto.body, { headers });
    }

    // ==================== LIXEIRA ====================

    if (pathname === '/trash' && method === 'GET') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const pastas = await env.DB.prepare('SELECT id, name, deleted_at FROM folders WHERE user_id = ? AND is_deleted = 1 ORDER BY deleted_at DESC').bind(auth.user.id).all();
      const arquivos = await env.DB.prepare('SELECT id, name, size_bytes, deleted_at FROM files WHERE user_id = ? AND is_deleted = 1 ORDER BY deleted_at DESC').bind(auth.user.id).all();
      return json({ ok: true, folders: pastas.results, files: arquivos.results });
    }

    if (pathname === '/trash/esvaziar' && method === 'POST') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      await esvaziarLixeira(env, auth.user.id);
      await logAtividade(env, auth.user.id, 'trash_empty', 'user', auth.user.id, request);
      return json({ ok: true });
    }

    m = pathname.match(/^\/trash\/(file|folder)\/([^/]+)$/);
    if (m && method === 'DELETE') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      if (m[1] === 'file') await excluirArquivoDeVez(env, m[2], auth.user.id);
      else await env.DB.prepare('DELETE FROM folders WHERE id = ? AND user_id = ? AND is_deleted = 1').bind(m[2], auth.user.id).run();
      return json({ ok: true });
    }

    // ==================== DISPOSITIVOS ====================

    if (pathname === '/devices' && method === 'GET') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const { results } = await env.DB.prepare(
        'SELECT id, name, platform, last_seen_at, first_seen_at FROM devices WHERE user_id = ? ORDER BY last_seen_at DESC'
      ).bind(auth.user.id).all();
      return json({ ok: true, devices: results.map((d) => ({ ...d, is_this_device: d.id === auth.deviceId })) });
    }

    m = pathname.match(/^\/devices\/([^/]+)$/);
    if (m && method === 'DELETE') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      await env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE device_id = ? AND user_id = ? AND revoked_at IS NULL')
        .bind(nowIso(), m[1], auth.user.id).run();
      return json({ ok: true });
    }

    // ==================== FAVORITOS / BUSCA / FOTOS ====================

    if (pathname === '/favoritos' && method === 'GET') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const pastas = await env.DB.prepare(
        'SELECT id, name, created_at, updated_at FROM folders WHERE user_id = ? AND is_deleted = 0 AND is_favorite = 1 ORDER BY name COLLATE NOCASE'
      ).bind(auth.user.id).all();
      const arquivos = await env.DB.prepare(
        'SELECT id, name, mime_type, size_bytes, category, created_at, updated_at FROM files WHERE user_id = ? AND is_deleted = 0 AND is_favorite = 1 ORDER BY name COLLATE NOCASE'
      ).bind(auth.user.id).all();
      return json({ ok: true, folders: pastas.results, files: arquivos.results });
    }

    if (pathname === '/busca' && method === 'GET') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const termo = new URL(request.url).searchParams.get('q') || '';
      const q = `%${termo}%`;
      const pastas = await env.DB.prepare(
        'SELECT id, name, created_at FROM folders WHERE user_id = ? AND is_deleted = 0 AND name LIKE ? ORDER BY name COLLATE NOCASE LIMIT 50'
      ).bind(auth.user.id, q).all();
      const arquivos = await env.DB.prepare(
        'SELECT id, name, mime_type, size_bytes, category, folder_id, created_at FROM files WHERE user_id = ? AND is_deleted = 0 AND name LIKE ? ORDER BY name COLLATE NOCASE LIMIT 50'
      ).bind(auth.user.id, q).all();
      return json({ ok: true, folders: pastas.results, files: arquivos.results });
    }

    if (pathname === '/fotos' && method === 'GET') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const { results } = await env.DB.prepare(
        `SELECT id, name, mime_type, size_bytes, category, created_at FROM files
         WHERE user_id = ? AND is_deleted = 0 AND category IN ('foto', 'video')
         ORDER BY created_at DESC LIMIT 500`
      ).bind(auth.user.id).all();
      return json({ ok: true, files: results });
    }

    // ==================== ALBUNS ====================

    if (pathname === '/albuns' && method === 'GET') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const { results } = await env.DB.prepare(
        `SELECT a.id, a.name, a.created_at, a.cover_file_id,
                (SELECT COUNT(*) FROM album_items ai WHERE ai.album_id = a.id) AS quantidade
         FROM albums a WHERE a.user_id = ? ORDER BY a.created_at DESC`
      ).bind(auth.user.id).all();
      return json({ ok: true, albuns: results });
    }

    if (pathname === '/albuns' && method === 'POST') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const body = await request.json().catch(() => ({}));
      const nome = (body.name || '').trim();
      if (!nome) return json({ ok: false, erro: 'nome_obrigatorio' }, 400);
      const id = uid();
      await env.DB.prepare('INSERT INTO albums (id, user_id, name, created_at) VALUES (?, ?, ?, ?)').bind(id, auth.user.id, nome, nowIso()).run();
      return json({ ok: true, album: { id, name: nome } });
    }

    m = pathname.match(/^\/albuns\/([^/]+)$/);
    if (m && method === 'GET') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const album = await env.DB.prepare('SELECT * FROM albums WHERE id = ? AND user_id = ?').bind(m[1], auth.user.id).first();
      if (!album) return json({ ok: false, erro: 'nao_encontrado' }, 404);
      const { results } = await env.DB.prepare(
        `SELECT f.id, f.name, f.mime_type, f.size_bytes, f.category, ai.added_at
         FROM album_items ai JOIN files f ON f.id = ai.file_id
         WHERE ai.album_id = ? AND f.is_deleted = 0 ORDER BY ai.added_at DESC`
      ).bind(m[1]).all();
      return json({ ok: true, album, files: results });
    }

    if (m && method === 'DELETE') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      await env.DB.prepare('DELETE FROM album_items WHERE album_id = ?').bind(m[1]).run();
      const r = await env.DB.prepare('DELETE FROM albums WHERE id = ? AND user_id = ?').bind(m[1], auth.user.id).run();
      if (!r.meta.rows_written) return json({ ok: false, erro: 'nao_encontrado' }, 404);
      return json({ ok: true });
    }

    m = pathname.match(/^\/albuns\/([^/]+)\/itens$/);
    if (m && method === 'POST') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const album = await env.DB.prepare('SELECT id, cover_file_id FROM albums WHERE id = ? AND user_id = ?').bind(m[1], auth.user.id).first();
      if (!album) return json({ ok: false, erro: 'nao_encontrado' }, 404);
      const body = await request.json().catch(() => ({}));
      const arq = await env.DB.prepare('SELECT id FROM files WHERE id = ? AND user_id = ? AND is_deleted = 0').bind(body.file_id, auth.user.id).first();
      if (!arq) return json({ ok: false, erro: 'arquivo_nao_encontrado' }, 404);
      await env.DB.prepare('INSERT OR IGNORE INTO album_items (album_id, file_id, added_at) VALUES (?, ?, ?)').bind(m[1], body.file_id, nowIso()).run();
      if (!album.cover_file_id) await env.DB.prepare('UPDATE albums SET cover_file_id = ? WHERE id = ?').bind(body.file_id, m[1]).run();
      return json({ ok: true });
    }

    m = pathname.match(/^\/albuns\/([^/]+)\/itens\/([^/]+)$/);
    if (m && method === 'DELETE') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      await env.DB.prepare('DELETE FROM album_items WHERE album_id = ? AND file_id = ?').bind(m[1], m[2]).run();
      return json({ ok: true });
    }

    // ==================== COMPARTILHAMENTO ====================

    // Compartilhamento direto com outra conta LeuCloud (identificada pelo
    // e-mail). Acesso de leitura/download real, resolvido em /folders/:id
    // e /files/:id/download (nunca so cosmetico).
    if (pathname === '/compartilhar-com' && method === 'POST') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const body = await request.json().catch(() => ({}));
      const fileId = body.file_id || null;
      const folderId = body.folder_id || null;
      const emailDestino = (body.email || '').trim().toLowerCase();
      if ((!fileId && !folderId) || (fileId && folderId) || !emailDestino) return json({ ok: false, erro: 'dados_invalidos' }, 400);
      if (emailDestino === auth.user.email) return json({ ok: false, erro: 'nao_pode_compartilhar_com_voce_mesmo' }, 400);
      const destino = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(emailDestino).first();
      if (!destino) return json({ ok: false, erro: 'usuario_nao_encontrado' }, 404);
      if (fileId) {
        const dono = await env.DB.prepare('SELECT id FROM files WHERE id = ? AND user_id = ? AND is_deleted = 0').bind(fileId, auth.user.id).first();
        if (!dono) return json({ ok: false, erro: 'nao_encontrado' }, 404);
      } else {
        const dono = await env.DB.prepare('SELECT id FROM folders WHERE id = ? AND user_id = ? AND is_deleted = 0').bind(folderId, auth.user.id).first();
        if (!dono) return json({ ok: false, erro: 'nao_encontrada' }, 404);
      }
      await env.DB.prepare(
        `INSERT OR IGNORE INTO share_recipients (id, owner_id, file_id, folder_id, shared_with_user_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(uid(), auth.user.id, fileId, folderId, destino.id, nowIso()).run();
      await env.DB.prepare(
        `INSERT INTO notifications (id, user_id, type, title, body, created_at) VALUES (?, ?, 'novo_compartilhamento', ?, ?, ?)`
      ).bind(uid(), destino.id, 'Novo item compartilhado', `${auth.user.name} compartilhou algo com você no LeuCloud.`, nowIso()).run();
      await logAtividade(env, auth.user.id, 'share_recipient_add', fileId ? 'file' : 'folder', fileId || folderId, request, { destino: destino.id });
      return json({ ok: true });
    }

    if (pathname === '/compartilhado-comigo' && method === 'GET') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const { results } = await env.DB.prepare(
        `SELECT sr.id, sr.file_id, sr.folder_id, sr.created_at, u.name AS dono_nome, u.email AS dono_email,
                f.name AS arquivo_nome, f.size_bytes, f.mime_type, f.category,
                p.name AS pasta_nome
         FROM share_recipients sr
         JOIN users u ON u.id = sr.owner_id
         LEFT JOIN files f ON f.id = sr.file_id
         LEFT JOIN folders p ON p.id = sr.folder_id
         WHERE sr.shared_with_user_id = ?
         ORDER BY sr.created_at DESC`
      ).bind(auth.user.id).all();
      return json({ ok: true, itens: results });
    }

    if (pathname === '/compartilhado-por-mim' && method === 'GET') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const { results } = await env.DB.prepare(
        `SELECT sr.id, sr.file_id, sr.folder_id, sr.created_at, u.name AS destino_nome, u.email AS destino_email,
                f.name AS arquivo_nome, p.name AS pasta_nome
         FROM share_recipients sr
         JOIN users u ON u.id = sr.shared_with_user_id
         LEFT JOIN files f ON f.id = sr.file_id
         LEFT JOIN folders p ON p.id = sr.folder_id
         WHERE sr.owner_id = ?
         ORDER BY sr.created_at DESC`
      ).bind(auth.user.id).all();
      return json({ ok: true, itens: results });
    }

    m = pathname.match(/^\/compartilhado\/([^/]+)$/);
    if (m && method === 'DELETE') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      await env.DB.prepare('DELETE FROM share_recipients WHERE id = ? AND owner_id = ?').bind(m[1], auth.user.id).run();
      return json({ ok: true });
    }

    // ---- links publicos (/s/:token) — quem recebe o link nao precisa de conta ----

    if (pathname === '/shares' && method === 'POST') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const body = await request.json().catch(() => ({}));
      const fileId = body.file_id || null;
      const folderId = body.folder_id || null;
      if ((!fileId && !folderId) || (fileId && folderId)) return json({ ok: false, erro: 'informe_arquivo_ou_pasta' }, 400);
      if (fileId) {
        const dono = await env.DB.prepare('SELECT id FROM files WHERE id = ? AND user_id = ? AND is_deleted = 0').bind(fileId, auth.user.id).first();
        if (!dono) return json({ ok: false, erro: 'nao_encontrado' }, 404);
      } else {
        const dono = await env.DB.prepare('SELECT id FROM folders WHERE id = ? AND user_id = ? AND is_deleted = 0').bind(folderId, auth.user.id).first();
        if (!dono) return json({ ok: false, erro: 'nao_encontrada' }, 404);
      }
      const token = tokenAleatorio();
      let passwordHash = null;
      if (body.password) {
        const { hash, salt, iterations } = await hashSenha(body.password, env);
        passwordHash = JSON.stringify({ hash, salt, iterations });
      }
      const expiresAt = body.expires_in_days ? new Date(Date.now() + Number(body.expires_in_days) * 86400000).toISOString() : null;
      const id = uid();
      await env.DB.prepare(
        `INSERT INTO shares (id, owner_id, file_id, folder_id, token, password_hash, expires_at, max_downloads, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, auth.user.id, fileId, folderId, token, passwordHash, expiresAt, body.max_downloads || null, nowIso()).run();
      await logAtividade(env, auth.user.id, 'share_create', fileId ? 'file' : 'folder', fileId || folderId, request);
      return json({ ok: true, share: { id, token, url: urlCompartilhado(token) } });
    }

    if (pathname === '/shares' && method === 'GET') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const { results } = await env.DB.prepare(
        `SELECT s.id, s.token, s.file_id, s.folder_id, s.password_hash, s.expires_at, s.max_downloads, s.download_count, s.created_at,
                f.name AS arquivo_nome, p.name AS pasta_nome
         FROM shares s
         LEFT JOIN files f ON f.id = s.file_id
         LEFT JOIN folders p ON p.id = s.folder_id
         WHERE s.owner_id = ? AND s.revoked_at IS NULL
         ORDER BY s.created_at DESC`
      ).bind(auth.user.id).all();
      return json({
        ok: true,
        shares: results.map((r) => ({ ...r, tem_senha: !!r.password_hash, password_hash: undefined, url: urlCompartilhado(r.token) })),
      });
    }

    m = pathname.match(/^\/shares\/([^/]+)$/);
    if (m && method === 'DELETE') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      await env.DB.prepare('UPDATE shares SET revoked_at = ? WHERE id = ? AND owner_id = ?').bind(nowIso(), m[1], auth.user.id).run();
      return json({ ok: true });
    }

    // Publicas -- sem exigir sessao. So expoe o minimo (nome/tamanho/tipo)
    // antes da senha, quando o link tem senha.
    m = pathname.match(/^\/s\/([^/]+)$/);
    if (m && method === 'GET') {
      const share = await buscarShareValido(env, m[1]);
      if (!share) return json({ ok: false, erro: 'link_invalido_ou_expirado' }, 404);
      if (share.file_id) {
        const arq = await env.DB.prepare('SELECT name, size_bytes, mime_type, category FROM files WHERE id = ?').bind(share.file_id).first();
        if (!arq) return json({ ok: false, erro: 'link_invalido_ou_expirado' }, 404);
        return json({ ok: true, tipo: 'file', nome: arq.name, tamanho: arq.size_bytes, mime_type: arq.mime_type, categoria: arq.category, requer_senha: !!share.password_hash });
      }
      const pasta = await env.DB.prepare('SELECT name FROM folders WHERE id = ?').bind(share.folder_id).first();
      if (!pasta) return json({ ok: false, erro: 'link_invalido_ou_expirado' }, 404);
      return json({ ok: true, tipo: 'folder', nome: pasta.name, requer_senha: !!share.password_hash });
    }

    m = pathname.match(/^\/s\/([^/]+)\/pasta$/);
    if (m && method === 'POST') {
      const share = await buscarShareValido(env, m[1]);
      if (!share || !share.folder_id) return json({ ok: false, erro: 'link_invalido_ou_expirado' }, 404);
      const body = await request.json().catch(() => ({}));
      if (!(await confirmaSenhaShare(share, body.password, env))) return json({ ok: false, erro: 'senha_incorreta' }, 401);
      const arquivos = await env.DB.prepare(
        `SELECT id, name, size_bytes, mime_type, category FROM files WHERE folder_id = ? AND is_deleted = 0 ORDER BY sort_order, name COLLATE NOCASE`
      ).bind(share.folder_id).all();
      return json({ ok: true, files: arquivos.results });
    }

    m = pathname.match(/^\/s\/([^/]+)\/download$/);
    if (m && (method === 'GET' || method === 'POST')) {
      const share = await buscarShareValido(env, m[1]);
      if (!share || !share.file_id) return json({ ok: false, erro: 'link_invalido_ou_expirado' }, 404);
      const senha = method === 'GET'
        ? new URL(request.url).searchParams.get('password') || ''
        : (await request.json().catch(() => ({}))).password || '';
      if (!(await confirmaSenhaShare(share, senha, env))) return json({ ok: false, erro: 'senha_incorreta' }, 401);
      if (share.max_downloads && share.download_count >= share.max_downloads) return json({ ok: false, erro: 'limite_de_downloads_atingido' }, 403);
      const resposta = await respostaDownloadShare(env, share.file_id);
      if (!resposta) return json({ ok: false, erro: 'nao_encontrado' }, 404);
      await env.DB.prepare('UPDATE shares SET download_count = download_count + 1 WHERE id = ?').bind(share.id).run();
      return resposta;
    }

    m = pathname.match(/^\/s\/([^/]+)\/pasta\/arquivo\/([^/]+)\/download$/);
    if (m && method === 'POST') {
      const share = await buscarShareValido(env, m[1]);
      if (!share || !share.folder_id) return json({ ok: false, erro: 'link_invalido_ou_expirado' }, 404);
      const body = await request.json().catch(() => ({}));
      if (!(await confirmaSenhaShare(share, body.password, env))) return json({ ok: false, erro: 'senha_incorreta' }, 401);
      const arq = await env.DB.prepare('SELECT id FROM files WHERE id = ? AND folder_id = ? AND is_deleted = 0').bind(m[2], share.folder_id).first();
      if (!arq) return json({ ok: false, erro: 'nao_encontrado' }, 404);
      const resposta = await respostaDownloadShare(env, m[2]);
      if (!resposta) return json({ ok: false, erro: 'nao_encontrado' }, 404);
      await env.DB.prepare('UPDATE shares SET download_count = download_count + 1 WHERE id = ?').bind(share.id).run();
      return resposta;
    }

    // ==================== ADMIN ====================
    // Nao existe senha mestra separada: quem for admin de verdade
    // (is_admin_unlimited=1 na propria conta LeuCloud) entra com o
    // proprio login. Toda rota abaixo exige isso.
    if (pathname.startsWith('/admin/')) {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      if (!auth.user.is_admin_unlimited) return json({ ok: false, erro: 'acesso_negado' }, 403);
    }

    if (pathname === '/admin/resumo' && method === 'GET') {
      const totais = await env.DB.prepare(
        `SELECT COUNT(*) AS total_usuarios,
                SUM(storage_used_bytes) AS total_armazenamento_bytes,
                SUM(CASE WHEN status = 'ativo' THEN 1 ELSE 0 END) AS usuarios_ativos,
                SUM(CASE WHEN status = 'suspenso' THEN 1 ELSE 0 END) AS usuarios_suspensos
         FROM users`
      ).first();
      const porPlano = await env.DB.prepare(
        `SELECT plan_id, COUNT(*) AS quantidade FROM users GROUP BY plan_id`
      ).all();
      return json({ ok: true, totais, por_plano: porPlano.results });
    }

    if (pathname === '/admin/usuarios' && method === 'GET') {
      const { results } = await env.DB.prepare(
        `SELECT u.id, u.name, u.email, u.plan_id, u.storage_used_bytes, u.storage_quota_override_bytes,
                u.is_admin_unlimited, u.status, u.created_at, u.last_login_at, p.storage_bytes AS plan_storage_bytes
         FROM users u JOIN plans p ON p.id = u.plan_id
         ORDER BY u.created_at DESC`
      ).all();
      return json({ ok: true, usuarios: results });
    }

    m = pathname.match(/^\/admin\/usuarios\/([^/]+)\/plano$/);
    if (m && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const plano = await env.DB.prepare('SELECT id FROM plans WHERE id = ?').bind(body.plan_id).first();
      if (!plano) return json({ ok: false, erro: 'plano_invalido' }, 400);
      await env.DB.prepare('UPDATE users SET plan_id = ?, updated_at = ? WHERE id = ?').bind(body.plan_id, nowIso(), m[1]).run();
      await logAtividade(env, auth.user.id, 'admin_plan_change', 'user', m[1], request, { plan_id: body.plan_id });
      return json({ ok: true });
    }

    m = pathname.match(/^\/admin\/usuarios\/([^/]+)\/status$/);
    if (m && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (body.status !== 'ativo' && body.status !== 'suspenso') return json({ ok: false, erro: 'status_invalido' }, 400);
      await env.DB.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').bind(body.status, nowIso(), m[1]).run();
      if (body.status === 'suspenso') {
        await env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').bind(nowIso(), m[1]).run();
      }
      await logAtividade(env, auth.user.id, 'admin_status_change', 'user', m[1], request, { status: body.status });
      return json({ ok: true });
    }

    m = pathname.match(/^\/admin\/usuarios\/([^/]+)\/ilimitado$/);
    if (m && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      await env.DB.prepare('UPDATE users SET is_admin_unlimited = ?, updated_at = ? WHERE id = ?')
        .bind(body.ilimitado ? 1 : 0, nowIso(), m[1]).run();
      await logAtividade(env, auth.user.id, 'admin_unlimited_change', 'user', m[1], request, { ilimitado: !!body.ilimitado });
      return json({ ok: true });
    }

    m = pathname.match(/^\/admin\/usuarios\/([^/]+)\/cota$/);
    if (m && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const bytes = body.storage_quota_override_bytes === null ? null : Number(body.storage_quota_override_bytes);
      await env.DB.prepare('UPDATE users SET storage_quota_override_bytes = ?, updated_at = ? WHERE id = ?')
        .bind(bytes, nowIso(), m[1]).run();
      await logAtividade(env, auth.user.id, 'admin_quota_change', 'user', m[1], request, { storage_quota_override_bytes: bytes });
      return json({ ok: true });
    }

    if (pathname === '/admin/logs' && method === 'GET') {
      const { results } = await env.DB.prepare(
        `SELECT id, user_id, action, target_type, target_id, ip, metadata, created_at
         FROM activity_logs ORDER BY created_at DESC LIMIT 200`
      ).all();
      return json({ ok: true, logs: results });
    }

    return json({ ok: false, erro: 'rota_nao_encontrada' }, 404);
  },

  // Roda 1x por dia (ver [triggers] no wrangler.toml): purga de vez o que
  // esta na lixeira ha mais de LIXEIRA_DIAS, e limpa sessao/token vencido.
  async scheduled(event, env) {
    const limiteData = new Date(Date.now() - LIXEIRA_DIAS * 86400000).toISOString();
    const arquivosVencidos = await env.DB.prepare('SELECT id, user_id FROM files WHERE is_deleted = 1 AND deleted_at < ?').bind(limiteData).all();
    for (const f of arquivosVencidos.results) await excluirArquivoDeVez(env, f.id, f.user_id);
    await env.DB.prepare('DELETE FROM folders WHERE is_deleted = 1 AND deleted_at < ?').bind(limiteData).run();
    await env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(nowIso()).run();
    await env.DB.prepare('DELETE FROM auth_tokens WHERE expires_at < ?').bind(nowIso()).run();
    await env.DB.prepare('DELETE FROM auth_attempts WHERE created_at < ?').bind(new Date(Date.now() - 86400000).toISOString()).run();
  },
};

// ==================== funções auxiliares ====================

async function criarSessao(env, userId, platform, deviceName, request) {
  const agora = nowIso();
  const deviceId = uid();
  await env.DB.prepare(
    'INSERT INTO devices (id, user_id, name, platform, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(deviceId, userId, deviceName, platform, agora, agora).run();

  const sessionToken = tokenAleatorio();
  const tokenHash = await sha256Hex(sessionToken);
  const expira = new Date(Date.now() + SESSION_DIAS * 86400000).toISOString();
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, device_id, session_token_hash, ip_created, user_agent, created_at, last_seen_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(uid(), userId, deviceId, tokenHash, request.headers.get('CF-Connecting-IP') || null,
    request.headers.get('User-Agent') || null, agora, agora, expira).run();

  return { sessionToken, deviceId };
}

async function perfilPublico(env, userId) {
  const row = await env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.plan_id, u.storage_used_bytes, u.storage_quota_override_bytes,
            u.is_admin_unlimited, u.two_factor_enabled, u.locale, u.created_at, p.storage_bytes AS plan_storage_bytes
     FROM users u JOIN plans p ON p.id = u.plan_id WHERE u.id = ?`
  ).bind(userId).first();
  if (!row) return null;
  const limite = quotaBytes(row);
  return {
    id: row.id, name: row.name, email: row.email, plan_id: row.plan_id,
    storage_used_bytes: row.storage_used_bytes,
    storage_quota_bytes: limite, // null = sem limite
    storage_percent: limite ? Math.min(100, Math.round((row.storage_used_bytes / limite) * 100)) : 0,
    is_admin_unlimited: !!row.is_admin_unlimited,
    two_factor_enabled: !!row.two_factor_enabled,
    locale: row.locale, created_at: row.created_at,
  };
}

async function excluirPastaRecursivo(env, folderId, userId) {
  const agora = nowIso();
  await env.DB.prepare(
    `WITH RECURSIVE sub(id) AS (
       SELECT id FROM folders WHERE id = ? AND user_id = ?
       UNION ALL
       SELECT f.id FROM folders f JOIN sub s ON f.parent_id = s.id WHERE f.user_id = ?
     )
     UPDATE folders SET is_deleted = 1, deleted_at = ? WHERE id IN (SELECT id FROM sub)`
  ).bind(folderId, userId, userId, agora).run();
  await env.DB.prepare(
    `WITH RECURSIVE sub(id) AS (
       SELECT id FROM folders WHERE id = ? AND user_id = ?
       UNION ALL
       SELECT f.id FROM folders f JOIN sub s ON f.parent_id = s.id WHERE f.user_id = ?
     )
     UPDATE files SET is_deleted = 1, deleted_at = ? WHERE user_id = ? AND folder_id IN (SELECT id FROM sub)`
  ).bind(folderId, userId, userId, agora, userId).run();
}

async function restaurarPastaRecursivo(env, folderId, userId) {
  await env.DB.prepare(
    `WITH RECURSIVE sub(id) AS (
       SELECT id FROM folders WHERE id = ? AND user_id = ?
       UNION ALL
       SELECT f.id FROM folders f JOIN sub s ON f.parent_id = s.id WHERE f.user_id = ?
     )
     UPDATE folders SET is_deleted = 0, deleted_at = NULL WHERE id IN (SELECT id FROM sub)`
  ).bind(folderId, userId, userId).run();
  await env.DB.prepare(
    `WITH RECURSIVE sub(id) AS (
       SELECT id FROM folders WHERE id = ? AND user_id = ?
       UNION ALL
       SELECT f.id FROM folders f JOIN sub s ON f.parent_id = s.id WHERE f.user_id = ?
     )
     UPDATE files SET is_deleted = 0, deleted_at = NULL WHERE user_id = ? AND folder_id IN (SELECT id FROM sub)`
  ).bind(folderId, userId, userId, userId).run();
}

async function excluirArquivoDeVez(env, fileId, userId) {
  const arq = await env.DB.prepare('SELECT * FROM files WHERE id = ? AND user_id = ?').bind(fileId, userId).first();
  if (!arq) return;
  await env.ARQUIVOS.delete(arq.r2_key);
  const versoes = await env.DB.prepare('SELECT r2_key FROM file_versions WHERE file_id = ?').bind(fileId).all();
  for (const v of versoes.results) await env.ARQUIVOS.delete(v.r2_key);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM file_versions WHERE file_id = ?').bind(fileId),
    env.DB.prepare('DELETE FROM files WHERE id = ?').bind(fileId),
    env.DB.prepare('UPDATE users SET storage_used_bytes = MAX(0, storage_used_bytes - ?) WHERE id = ?').bind(arq.size_bytes, userId),
  ]);
}

async function esvaziarLixeira(env, userId) {
  const arquivos = await env.DB.prepare('SELECT id FROM files WHERE user_id = ? AND is_deleted = 1').bind(userId).all();
  for (const f of arquivos.results) await excluirArquivoDeVez(env, f.id, userId);
  await env.DB.prepare('DELETE FROM folders WHERE user_id = ? AND is_deleted = 1').bind(userId).run();
}

// Resolve quem realmente "possui" (para fins de listagem) uma pasta: o
// dono direto, ou -- se folderId (ou algum ancestral dele) foi
// compartilhado com userId via share_recipients -- o dono original,
// permitindo que o convidado navegue inclusive em subpastas de dentro
// da pasta compartilhada.
async function resolverAcessoPasta(env, folderId, userId) {
  const propria = await env.DB.prepare('SELECT user_id FROM folders WHERE id = ? AND is_deleted = 0').bind(folderId).first();
  if (!propria) return null;
  if (propria.user_id === userId) return { ownerId: userId };
  const convite = await env.DB.prepare(
    `WITH RECURSIVE subida(id, parent_id) AS (
       SELECT id, parent_id FROM folders WHERE id = ?
       UNION ALL
       SELECT f.id, f.parent_id FROM folders f JOIN subida s ON f.id = s.parent_id
     )
     SELECT 1 FROM share_recipients WHERE shared_with_user_id = ? AND folder_id IN (SELECT id FROM subida) LIMIT 1`
  ).bind(folderId, userId).first();
  if (!convite) return null;
  return { ownerId: propria.user_id };
}

// Um arquivo compartilhado diretamente OU dentro de uma pasta
// compartilhada (mesma logica recursiva de resolverAcessoPasta).
async function arquivoViaCompartilhamento(env, fileId, userId) {
  const arq = await env.DB.prepare('SELECT * FROM files WHERE id = ? AND is_deleted = 0').bind(fileId).first();
  if (!arq) return null;
  const direto = await env.DB.prepare('SELECT 1 FROM share_recipients WHERE file_id = ? AND shared_with_user_id = ?').bind(fileId, userId).first();
  if (direto) return arq;
  if (arq.folder_id) {
    const acesso = await resolverAcessoPasta(env, arq.folder_id, userId);
    if (acesso) return arq;
  }
  return null;
}

function urlCompartilhado(token) {
  return `https://leucloud.leunamesoftware.com.br/compartilhado.html?t=${token}`;
}

async function buscarShareValido(env, token) {
  const share = await env.DB.prepare('SELECT * FROM shares WHERE token = ? AND revoked_at IS NULL').bind(token).first();
  if (!share) return null;
  if (share.expires_at && share.expires_at < nowIso()) return null;
  return share;
}

async function confirmaSenhaShare(share, senhaDigitada, env) {
  if (!share.password_hash) return true;
  const dados = JSON.parse(share.password_hash);
  return verificarSenha(senhaDigitada || '', dados.salt, dados.hash, dados.iterations, env);
}

// ---- TOTP (RFC 6238) para 2FA -- HMAC-SHA1 via WebCrypto + base32 ----
const BASE32_ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Encode(bytes) {
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let saida = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) saida += BASE32_ALFABETO[parseInt(bits.slice(i, i + 5), 2)];
  const resto = bits.length % 5;
  if (resto) saida += BASE32_ALFABETO[parseInt(bits.slice(bits.length - resto).padEnd(5, '0'), 2)];
  return saida;
}
function base32Decode(str) {
  const limpo = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const c of limpo) bits += BASE32_ALFABETO.indexOf(c).toString(2).padStart(5, '0');
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return new Uint8Array(bytes);
}
async function gerarCodigoTotp(secretB32, contador) {
  const chave = await crypto.subtle.importKey('raw', base32Decode(secretB32), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const buf = new ArrayBuffer(8);
  new DataView(buf).setBigUint64(0, BigInt(contador), false);
  const assinatura = new Uint8Array(await crypto.subtle.sign('HMAC', chave, buf));
  const offset = assinatura[19] & 0xf;
  const binCode = ((assinatura[offset] & 0x7f) << 24) | ((assinatura[offset + 1] & 0xff) << 16) | ((assinatura[offset + 2] & 0xff) << 8) | (assinatura[offset + 3] & 0xff);
  return String(binCode % 1000000).padStart(6, '0');
}
// Aceita o passo atual de 30s e um passo antes/depois (tolerancia de
// relogio) -- mesma janela que Google Authenticator/Authy usam de fato.
async function verificarTotp(secretB32, codigoDigitado) {
  if (!/^\d{6}$/.test(codigoDigitado)) return false;
  const passoAtual = Math.floor(Date.now() / 1000 / 30);
  for (const delta of [0, -1, 1]) {
    if ((await gerarCodigoTotp(secretB32, passoAtual + delta)) === codigoDigitado) return true;
  }
  return false;
}

async function respostaDownloadShare(env, fileId) {
  const arq = await env.DB.prepare('SELECT * FROM files WHERE id = ? AND is_deleted = 0').bind(fileId).first();
  if (!arq) return null;
  const objeto = await env.ARQUIVOS.get(arq.r2_key);
  if (!objeto) return null;
  const headers = new Headers();
  objeto.writeHttpMetadata(headers);
  headers.set('Content-Disposition', `attachment; filename="${arq.name.replace(/"/g, '')}"`);
  headers.set('Access-Control-Allow-Origin', '*');
  return new Response(objeto.body, { headers });
}
