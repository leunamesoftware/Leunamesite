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

      const { sessionToken, deviceId } = await criarSessao(env, user.id, body.platform || 'web', body.device_name || null, request);
      await env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').bind(nowIso(), user.id).run();
      await logAtividade(env, user.id, 'login', 'user', user.id, request);
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

    // GET /folders/:id  (":id" = "root" para a raiz) -- lista subpastas e arquivos
    m = pathname.match(/^\/folders\/([^/]+)$/);
    if (m && method === 'GET') {
      if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const folderId = m[1] === 'root' ? null : m[1];
      const subpastas = await env.DB.prepare(
        `SELECT id, name, is_favorite, sort_order, created_at, updated_at FROM folders
         WHERE user_id = ? AND is_deleted = 0 AND (parent_id = ? OR (parent_id IS NULL AND ? IS NULL))
         ORDER BY sort_order, name COLLATE NOCASE`
      ).bind(auth.user.id, folderId, folderId).all();
      const arquivos = await env.DB.prepare(
        `SELECT id, name, mime_type, size_bytes, category, is_favorite, sort_order, created_at, updated_at FROM files
         WHERE user_id = ? AND is_deleted = 0 AND (folder_id = ? OR (folder_id IS NULL AND ? IS NULL))
         ORDER BY sort_order, name COLLATE NOCASE`
      ).bind(auth.user.id, folderId, folderId).all();
      return json({ ok: true, folders: subpastas.results, files: arquivos.results });
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
      const arq = await env.DB.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND is_deleted = 0').bind(m[1], auth.user.id).first();
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
