// Sucatel — servidor (Cloudflare Worker + D1 + R2) — LeuName Softwares
//
// Marketplace de peças de celular usadas. Anúncio pago por crédito (1
// crédito = R$5 = 1 anúncio por 30 dias, renovável, pode vender quantas
// unidades daquele item tiver dentro dos 30 dias sem pagar de novo).
// Busca sempre filtrada por bairro (entrega é sempre presencial). Chat
// interno bloqueia telefone/WhatsApp no texto. Mesmo estilo de rota
// "flat" usado no servidor de licenças e no LeuCloud.

const PBKDF2_ITERACOES = 100000; // máximo suportado pelo WebCrypto do Workers

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-File-Name',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    },
  });
}
function uid() { return crypto.randomUUID(); }
function slugify(texto) {
  return texto.toString().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
}
function nowIso() { return new Date().toISOString(); }
function addDiasIso(dias) { return new Date(Date.now() + dias * 86400000).toISOString(); }

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

// ---- senha: PBKDF2 com salt por usuário + "pepper" secreto do servidor ----
async function hashSenha(senha, env) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(senha + env.PASSWORD_PEPPER), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: PBKDF2_ITERACOES, hash: 'SHA-256' }, material, 256);
  return `pbkdf2$${PBKDF2_ITERACOES}$${bufToB64(salt)}$${bufToB64(bits)}`;
}
async function verificarSenha(senha, hashArmazenado, env) {
  const partes = (hashArmazenado || '').split('$');
  if (partes.length !== 4) return false;
  const [, iterStr, saltB64, hashB64] = partes;
  const iterations = Number(iterStr);
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(senha + env.PASSWORD_PEPPER), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: b64ToBuf(saltB64), iterations, hash: 'SHA-256' }, material, 256);
  return bufToB64(bits) === hashB64;
}

async function limiteExcedido(env, identifier, kind, maxTentativas = 10) {
  const desde = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const row = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM auth_attempts WHERE identifier = ? AND kind = ? AND criado_em > ?'
  ).bind(identifier, kind, desde).first();
  return (row?.n || 0) >= maxTentativas;
}
async function registrarTentativa(env, identifier, kind, succeeded) {
  await env.DB.prepare(
    'INSERT INTO auth_attempts (id, identifier, kind, succeeded, criado_em) VALUES (?, ?, ?, ?, ?)'
  ).bind(uid(), identifier, kind, succeeded ? 1 : 0, nowIso()).run();
}

async function autenticar(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return null;
  const hash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT s.id AS session_id, u.* FROM sessoes s JOIN users u ON u.id = s.user_id
     WHERE s.session_token_hash = ? AND s.revogada_em IS NULL AND s.expira_em > ?`
  ).bind(hash, nowIso()).first();
  return row || null;
}

async function usuarioPublico(u, env) {
  let bairro_nome = null;
  if (u.bairro_id) {
    const b = await env.DB.prepare('SELECT nome FROM bairros WHERE id = ?').bind(u.bairro_id).first();
    bairro_nome = b ? b.nome : null;
  }
  return {
    id: u.id, nome: u.nome, email: u.email, telefone: u.telefone,
    bairro_id: u.bairro_id, bairro_nome, saldo_creditos: u.saldo_creditos,
    vendas_confirmadas_total: u.vendas_confirmadas_total, reputacao: u.reputacao,
    is_admin: !!u.is_admin, verificado: !!u.verificado, criado_em: u.criado_em,
    foto_url: u.foto_url || null,
  };
}

// Bloqueia numero de telefone (8-11 digitos, com ou sem separadores) e
// mencao a whatsapp/zap no texto do chat -- protege as pessoas de golpe
// e mantem a negociacao dentro do app.
const REGEX_TELEFONE = /(\+?\d[\s().-]?){8,}/;
const REGEX_WHATSAPP = /whats\s*app|\bzap\b|\bwpp\b/i;
function contemContatoExterno(texto) {
  return REGEX_TELEFONE.test(texto) || REGEX_WHATSAPP.test(texto);
}

// Palavras fora do tema (peca de celular) -- bloqueio simples de titulo/descricao.
const PALAVRAS_FORA_DO_TEMA = ['guarda-roupa', 'geladeira', 'sofa', 'sofá', 'cama', 'colchao', 'colchão', 'carro', 'moto ', 'roupa', 'tenis', 'tênis'];
function contemPalavraForaDoTema(texto) {
  const t = (texto || '').toLowerCase();
  return PALAVRAS_FORA_DO_TEMA.some((p) => t.includes(p));
}

async function expirarAnunciosVencidos(env) {
  await env.DB.prepare(
    "UPDATE anuncios SET status = 'expirado' WHERE status = 'ativo' AND expira_em <= ?"
  ).bind(nowIso()).run();
}

const CONDICOES_VALIDAS = ['novo', 'usado', 'com_defeito', 'sucata'];

// Distância real entre dois pontos (fórmula de Haversine), em km.
function distanciaKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Bairros dentro do raio da região do usuário (mesmo espírito de "por
// bairro/região" pedido: mostra o entorno real, nunca uma cidade distante).
// Sem coordenada cadastrada, cai de volta pro bairro exato (nunca quebra).
async function bairrosDaRegiao(env, bairroId, raioKm) {
  const origem = await env.DB.prepare('SELECT id, lat, lng FROM bairros WHERE id = ?').bind(bairroId).first();
  if (!origem || origem.lat == null || origem.lng == null) return { ids: [bairroId], distancias: { [bairroId]: 0 } };
  const { results } = await env.DB.prepare('SELECT id, lat, lng FROM bairros WHERE lat IS NOT NULL AND lng IS NOT NULL').all();
  const ids = [];
  const distancias = {};
  for (const b of results) {
    const d = distanciaKm(origem.lat, origem.lng, b.lat, b.lng);
    if (d <= raioKm) { ids.push(b.id); distancias[b.id] = Math.round(d * 10) / 10; }
  }
  if (!ids.includes(bairroId)) { ids.push(bairroId); distancias[bairroId] = 0; }
  return { ids, distancias };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    if (request.method === 'OPTIONS') return json({});

    if (pathname === '/health') return json({ ok: true, servico: 'sucatel' });

    // ---- localização ----
    if (pathname === '/localizacao/estados' && request.method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM estados ORDER BY nome').all();
      return json({ ok: true, estados: results });
    }
    if (pathname === '/localizacao/cidades' && request.method === 'GET') {
      const estadoId = url.searchParams.get('estado_id');
      if (!estadoId) return json({ ok: false, erro: 'estado_id_obrigatorio' }, 400);
      const { results } = await env.DB.prepare('SELECT * FROM cidades WHERE estado_id = ? ORDER BY nome').bind(estadoId).all();
      return json({ ok: true, cidades: results });
    }
    // Mesma lógica do bairro: só temos a capital de cada estado cadastrada
    // de início, então a pessoa cadastra a cidade dela se não estiver na lista.
    if (pathname === '/localizacao/cidades' && request.method === 'POST') {
      const ip = request.headers.get('CF-Connecting-IP') || 'sem-ip';
      if (await limiteExcedido(env, ip, 'criar_cidade', 20)) return json({ ok: false, erro: 'muitas_tentativas' }, 429);
      const { estado_id, nome } = await request.json();
      if (!estado_id || !nome || !nome.trim()) return json({ ok: false, erro: 'campos_obrigatorios' }, 400);
      const estado = await env.DB.prepare('SELECT id FROM estados WHERE id = ?').bind(estado_id).first();
      if (!estado) return json({ ok: false, erro: 'estado_invalido' }, 400);
      const nomeFinal = nome.trim().slice(0, 80);
      await registrarTentativa(env, ip, 'criar_cidade', true);
      const existente = await env.DB.prepare('SELECT * FROM cidades WHERE estado_id = ? AND LOWER(nome) = LOWER(?)').bind(estado_id, nomeFinal).first();
      if (existente) return json({ ok: true, cidade: existente });
      let id = slugify(nomeFinal) || uid();
      if (await env.DB.prepare('SELECT id FROM cidades WHERE id = ?').bind(id).first()) id = id + '-' + uid().slice(0, 6);
      await env.DB.prepare('INSERT INTO cidades (id, estado_id, nome) VALUES (?, ?, ?)').bind(id, estado_id, nomeFinal).run();
      const cidade = await env.DB.prepare('SELECT * FROM cidades WHERE id = ?').bind(id).first();
      return json({ ok: true, cidade }, 201);
    }
    if (pathname === '/localizacao/bairros' && request.method === 'GET') {
      const cidadeId = url.searchParams.get('cidade_id');
      if (!cidadeId) return json({ ok: false, erro: 'cidade_id_obrigatorio' }, 400);
      const { results } = await env.DB.prepare('SELECT * FROM bairros WHERE cidade_id = ? ORDER BY nome').bind(cidadeId).all();
      return json({ ok: true, bairros: results });
    }
    // Deixa a pessoa cadastrar o bairro dela quando não está na lista --
    // nossa lista inicial cobre só alguns bairros de exemplo, o Brasil real
    // tem milhares. O bairro novo entra sem coordenada (distância cai pro
    // modo "só esse bairro exato" até alguém revisar/ajustar depois).
    if (pathname === '/localizacao/bairros' && request.method === 'POST') {
      const ip = request.headers.get('CF-Connecting-IP') || 'sem-ip';
      if (await limiteExcedido(env, ip, 'criar_bairro', 20)) return json({ ok: false, erro: 'muitas_tentativas' }, 429);
      const { cidade_id, nome } = await request.json();
      if (!cidade_id || !nome || !nome.trim()) return json({ ok: false, erro: 'campos_obrigatorios' }, 400);
      const cidade = await env.DB.prepare('SELECT id FROM cidades WHERE id = ?').bind(cidade_id).first();
      if (!cidade) return json({ ok: false, erro: 'cidade_invalida' }, 400);
      const nomeFinal = nome.trim().slice(0, 80);
      await registrarTentativa(env, ip, 'criar_bairro', true);
      const existente = await env.DB.prepare('SELECT * FROM bairros WHERE cidade_id = ? AND LOWER(nome) = LOWER(?)').bind(cidade_id, nomeFinal).first();
      if (existente) return json({ ok: true, bairro: existente });
      let id = slugify(nomeFinal) || uid();
      if (await env.DB.prepare('SELECT id FROM bairros WHERE id = ?').bind(id).first()) id = id + '-' + uid().slice(0, 6);
      await env.DB.prepare('INSERT INTO bairros (id, cidade_id, nome) VALUES (?, ?, ?)').bind(id, cidade_id, nomeFinal).run();
      const bairro = await env.DB.prepare('SELECT * FROM bairros WHERE id = ?').bind(id).first();
      return json({ ok: true, bairro }, 201);
    }

    // ---- categorias (marca > modelo > tipo de peça) ----
    if (pathname === '/categorias/marcas' && request.method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM marcas ORDER BY ordem, nome').all();
      return json({ ok: true, marcas: results });
    }
    if (pathname === '/categorias/modelos' && request.method === 'GET') {
      const marcaId = url.searchParams.get('marca_id');
      if (!marcaId) return json({ ok: false, erro: 'marca_id_obrigatorio' }, 400);
      const { results } = await env.DB.prepare('SELECT * FROM modelos WHERE marca_id = ? ORDER BY nome').bind(marcaId).all();
      return json({ ok: true, modelos: results });
    }
    if (pathname === '/categorias/tipos-peca' && request.method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM tipos_peca ORDER BY ordem').all();
      return json({ ok: true, tipos_peca: results });
    }

    // ---- auth ----
    if (pathname === '/auth/cadastro' && request.method === 'POST') {
      const body = await request.json();
      const { nome, email, senha, telefone, bairro_id } = body;
      if (!nome || !email || !senha || !bairro_id) return json({ ok: false, erro: 'campos_obrigatorios' }, 400);
      if (senha.length < 6) return json({ ok: false, erro: 'senha_muito_curta' }, 400);
      const ip = request.headers.get('CF-Connecting-IP') || 'sem-ip';
      if (await limiteExcedido(env, ip, 'cadastro')) return json({ ok: false, erro: 'muitas_tentativas' }, 429);
      const existente = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase().trim()).first();
      if (existente) { await registrarTentativa(env, ip, 'cadastro', false); return json({ ok: false, erro: 'email_ja_cadastrado' }, 409); }
      const senhaHash = await hashSenha(senha, env);
      const id = uid();
      await env.DB.prepare(
        'INSERT INTO users (id, nome, email, telefone, senha_hash, bairro_id) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(id, nome.trim(), email.toLowerCase().trim(), telefone || null, senhaHash, bairro_id).run();
      await registrarTentativa(env, ip, 'cadastro', true);
      const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
      const token = tokenAleatorio();
      await env.DB.prepare(
        'INSERT INTO sessoes (id, session_token_hash, user_id, expira_em) VALUES (?, ?, ?, ?)'
      ).bind(uid(), await sha256Hex(token), id, addDiasIso(30)).run();
      return json({ ok: true, token, usuario: await usuarioPublico(user, env) }, 201);
    }

    if (pathname === '/auth/login' && request.method === 'POST') {
      const { email, senha } = await request.json();
      if (!email || !senha) return json({ ok: false, erro: 'campos_obrigatorios' }, 400);
      const ident = email.toLowerCase().trim();
      if (await limiteExcedido(env, ident, 'login')) return json({ ok: false, erro: 'muitas_tentativas' }, 429);
      const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(ident).first();
      const valido = user ? await verificarSenha(senha, user.senha_hash, env) : false;
      await registrarTentativa(env, ident, 'login', valido);
      if (!valido) return json({ ok: false, erro: 'credenciais_invalidas' }, 401);
      const token = tokenAleatorio();
      await env.DB.prepare(
        'INSERT INTO sessoes (id, session_token_hash, user_id, expira_em) VALUES (?, ?, ?, ?)'
      ).bind(uid(), await sha256Hex(token), user.id, addDiasIso(30)).run();
      return json({ ok: true, token, usuario: await usuarioPublico(user, env) });
    }

    if (pathname === '/auth/logout' && request.method === 'POST') {
      const auth = request.headers.get('Authorization') || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
      if (token) await env.DB.prepare('UPDATE sessoes SET revogada_em = ? WHERE session_token_hash = ?').bind(nowIso(), await sha256Hex(token)).run();
      return json({ ok: true });
    }

    if (pathname === '/auth/me' && request.method === 'GET') {
      const sess = await autenticar(request, env);
      if (!sess) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      return json({ ok: true, usuario: await usuarioPublico(sess, env) });
    }

    if (pathname === '/auth/me' && request.method === 'PATCH') {
      const sess = await autenticar(request, env);
      if (!sess) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const { nome, telefone, bairro_id, foto_url } = await request.json();
      if (nome && !nome.trim()) return json({ ok: false, erro: 'nome_invalido' }, 400);
      await env.DB.prepare('UPDATE users SET nome = ?, telefone = ?, bairro_id = ?, foto_url = ? WHERE id = ?')
        .bind(
          nome ? nome.trim() : sess.nome,
          telefone !== undefined ? (telefone || null) : sess.telefone,
          bairro_id || sess.bairro_id,
          foto_url !== undefined ? (foto_url || null) : sess.foto_url,
          sess.id
        ).run();
      const atualizado = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(sess.id).first();
      return json({ ok: true, usuario: await usuarioPublico(atualizado, env) });
    }

    if (pathname === '/auth/trocar-senha' && request.method === 'POST') {
      const sess = await autenticar(request, env);
      if (!sess) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const { senha_atual, nova_senha } = await request.json();
      if (!senha_atual || !nova_senha) return json({ ok: false, erro: 'campos_obrigatorios' }, 400);
      if (nova_senha.length < 6) return json({ ok: false, erro: 'senha_muito_curta' }, 400);
      const valido = await verificarSenha(senha_atual, sess.senha_hash, env);
      if (!valido) return json({ ok: false, erro: 'senha_atual_incorreta' }, 401);
      const novoHash = await hashSenha(nova_senha, env);
      await env.DB.prepare('UPDATE users SET senha_hash = ? WHERE id = ?').bind(novoHash, sess.id).run();
      return json({ ok: true });
    }

    if (pathname === '/auth/me' && request.method === 'DELETE') {
      const sess = await autenticar(request, env);
      if (!sess) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      // Anonimiza em vez de apagar a linha: conversas, mensagens e
      // avaliações de outras pessoas continuam referenciando esse usuário
      // (chave estrangeira), então um DELETE literal quebraria isso. O
      // e-mail some (libera pra um novo cadastro) e o login fica impossível.
      const senhaInutilizavel = await hashSenha(tokenAleatorio(), env);
      await env.DB.batch([
        env.DB.prepare('UPDATE sessoes SET revogada_em = ? WHERE user_id = ?').bind(nowIso(), sess.id),
        env.DB.prepare("UPDATE anuncios SET status = 'removido_admin' WHERE vendedor_id = ?").bind(sess.id),
        env.DB.prepare("UPDATE users SET nome = 'Conta excluída', email = ?, telefone = NULL, senha_hash = ? WHERE id = ?")
          .bind(`excluido-${sess.id}@sucatel.invalid`, senhaInutilizavel, sess.id),
      ]);
      return json({ ok: true });
    }

    // ---- créditos ----
    if (pathname === '/creditos/saldo' && request.method === 'GET') {
      const sess = await autenticar(request, env);
      if (!sess) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      return json({ ok: true, saldo_creditos: sess.saldo_creditos, vendas_confirmadas_total: sess.vendas_confirmadas_total });
    }

    if (pathname === '/creditos/comprar' && request.method === 'POST') {
      const sess = await autenticar(request, env);
      if (!sess) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const { quantidade } = await request.json();
      const qtd = Number(quantidade);
      if (!Number.isInteger(qtd) || qtd < 1 || qtd > 500) return json({ ok: false, erro: 'quantidade_invalida' }, 400);
      const valorCentavos = qtd * Number(env.CREDITO_VALOR_CENTAVOS || 500);

      if (!env.ASAAS_API_KEY) {
        // Sem a chave do Asaas configurada ainda: registra o pedido como
        // pendente, mas nao gera cobranca real -- evita fingir pagamento.
        const id = uid();
        await env.DB.prepare(
          'INSERT INTO pagamentos_creditos (id, user_id, quantidade_creditos, valor_centavos, status) VALUES (?, ?, ?, ?, ?)'
        ).bind(id, sess.id, qtd, valorCentavos, 'pendente').run();
        return json({ ok: false, erro: 'pagamento_nao_configurado', mensagem: 'O sistema de pagamento (Asaas) ainda não foi configurado pelo administrador.' }, 503);
      }

      // Cria cliente + cobrança Pix no Asaas.
      const clienteResp = await fetch(`${env.ASAAS_BASE_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', access_token: env.ASAAS_API_KEY },
        body: JSON.stringify({ name: sess.nome, email: sess.email, externalReference: sess.id }),
      });
      const cliente = await clienteResp.json();
      const customerId = cliente.id || cliente?.errors?.[0]?.description;
      if (!cliente.id) return json({ ok: false, erro: 'falha_asaas_cliente', detalhes: cliente }, 502);

      const id = uid();
      const cobrancaResp = await fetch(`${env.ASAAS_BASE_URL}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', access_token: env.ASAAS_API_KEY },
        body: JSON.stringify({
          customer: customerId,
          billingType: 'PIX',
          value: valorCentavos / 100,
          description: `Sucatel — ${qtd} crédito(s) de anúncio`,
          externalReference: id,
        }),
      });
      const cobranca = await cobrancaResp.json();
      if (!cobranca.id) return json({ ok: false, erro: 'falha_asaas_cobranca', detalhes: cobranca }, 502);

      await env.DB.prepare(
        'INSERT INTO pagamentos_creditos (id, user_id, quantidade_creditos, valor_centavos, asaas_payment_id, status) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(id, sess.id, qtd, valorCentavos, cobranca.id, 'pendente').run();

      const qrResp = await fetch(`${env.ASAAS_BASE_URL}/payments/${cobranca.id}/pixQrCode`, {
        headers: { access_token: env.ASAAS_API_KEY },
      });
      const qr = await qrResp.json();
      return json({ ok: true, pagamento_id: id, valor_centavos: valorCentavos, pix_copia_cola: qr.payload || null, qr_code_base64: qr.encodedImage || null });
    }

    // Webhook do Asaas — confirma pagamento e libera os créditos na hora.
    if (pathname === '/webhooks/asaas' && request.method === 'POST') {
      const tokenRecebido = request.headers.get('asaas-access-token') || '';
      if (!env.ASAAS_WEBHOOK_TOKEN || tokenRecebido !== env.ASAAS_WEBHOOK_TOKEN) return json({ ok: false, erro: 'token_invalido' }, 401);
      const evento = await request.json();
      const payment = evento.payment || {};
      if (evento.event === 'PAYMENT_CONFIRMED' || evento.event === 'PAYMENT_RECEIVED') {
        const pagamento = await env.DB.prepare('SELECT * FROM pagamentos_creditos WHERE asaas_payment_id = ?').bind(payment.id).first();
        if (pagamento && pagamento.status !== 'confirmado') {
          await env.DB.prepare("UPDATE pagamentos_creditos SET status = 'confirmado', confirmado_em = ? WHERE id = ?").bind(nowIso(), pagamento.id).run();
          await env.DB.prepare('UPDATE users SET saldo_creditos = saldo_creditos + ? WHERE id = ?').bind(pagamento.quantidade_creditos, pagamento.user_id).run();
        }
      }
      return json({ ok: true });
    }

    // ---- anúncios ----
    if (pathname === '/anuncios' && request.method === 'POST') {
      const sess = await autenticar(request, env);
      if (!sess) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const { marca_id, modelo_id, tipo_peca_id, titulo, descricao, preco_centavos, fotos, bairro_id, condicao } = await request.json();
      if (!marca_id || !modelo_id || !tipo_peca_id || !titulo || !preco_centavos || !bairro_id) {
        return json({ ok: false, erro: 'campos_obrigatorios' }, 400);
      }
      const condicaoFinal = CONDICOES_VALIDAS.includes(condicao) ? condicao : 'usado';
      if (contemPalavraForaDoTema(titulo) || contemPalavraForaDoTema(descricao)) {
        return json({ ok: false, erro: 'fora_do_tema', mensagem: 'Este anúncio só aceita peças de celular.' }, 400);
      }
      if (sess.saldo_creditos < 1 && !sess.is_admin) return json({ ok: false, erro: 'sem_creditos', mensagem: 'Você não tem créditos. Compre créditos para anunciar.' }, 402);

      const id = uid();
      const duracaoDias = Number(env.ANUNCIO_DURACAO_DIAS || 30);
      const operacoes = [
        env.DB.prepare(
          `INSERT INTO anuncios (id, vendedor_id, marca_id, modelo_id, tipo_peca_id, titulo, descricao, preco_centavos, fotos, bairro_id, condicao, status, expira_em)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativo', ?)`
        ).bind(id, sess.id, marca_id, modelo_id, tipo_peca_id, titulo.trim(), descricao || '', preco_centavos, JSON.stringify(fotos || []), bairro_id, condicaoFinal, addDiasIso(duracaoDias)),
      ];
      // Conta admin (dona da plataforma) nunca fica sem crédito.
      if (!sess.is_admin) operacoes.push(env.DB.prepare('UPDATE users SET saldo_creditos = saldo_creditos - 1 WHERE id = ?').bind(sess.id));
      await env.DB.batch(operacoes);
      const anuncio = await env.DB.prepare('SELECT * FROM anuncios WHERE id = ?').bind(id).first();
      return json({ ok: true, anuncio }, 201);
    }

    if (pathname === '/anuncios' && request.method === 'GET') {
      await expirarAnunciosVencidos(env);
      const bairroId = url.searchParams.get('bairro_id');
      const marcaId = url.searchParams.get('marca_id');
      const modeloId = url.searchParams.get('modelo_id');
      const tipoPecaId = url.searchParams.get('tipo_peca_id');
      const grupo = url.searchParams.get('grupo');
      const condicao = url.searchParams.get('condicao');
      const busca = url.searchParams.get('busca');
      if (!bairroId) return json({ ok: false, erro: 'bairro_id_obrigatorio' }, 400);
      const raioKm = Number(env.RAIO_BUSCA_KM || 10);
      const { ids: bairrosRegiao, distancias } = await bairrosDaRegiao(env, bairroId, raioKm);

      let sql = `SELECT a.*, u.nome AS vendedor_nome, u.reputacao AS vendedor_reputacao, u.verificado AS vendedor_verificado, u.foto_url AS vendedor_foto,
                        m.nome AS marca_nome, mo.nome AS modelo_nome, tp.nome AS tipo_peca_nome, b.nome AS bairro_nome
                 FROM anuncios a
                 JOIN users u ON u.id = a.vendedor_id
                 JOIN marcas m ON m.id = a.marca_id
                 JOIN modelos mo ON mo.id = a.modelo_id
                 JOIN tipos_peca tp ON tp.id = a.tipo_peca_id
                 JOIN bairros b ON b.id = a.bairro_id
                 WHERE a.status = 'ativo' AND a.bairro_id IN (${bairrosRegiao.map(() => '?').join(',')})`;
      const params = [...bairrosRegiao];
      if (marcaId) { sql += ' AND a.marca_id = ?'; params.push(marcaId); }
      if (modeloId) { sql += ' AND a.modelo_id = ?'; params.push(modeloId); }
      if (tipoPecaId) { sql += ' AND a.tipo_peca_id = ?'; params.push(tipoPecaId); }
      if (grupo) { sql += ' AND a.tipo_peca_id IN (SELECT id FROM tipos_peca WHERE grupo = ?)'; params.push(grupo); }
      if (condicao) { sql += ' AND a.condicao = ?'; params.push(condicao); }
      if (busca) { sql += ' AND (a.titulo LIKE ? OR a.descricao LIKE ?)'; params.push(`%${busca}%`, `%${busca}%`); }
      sql += ' ORDER BY a.criado_em DESC LIMIT 100';
      const { results } = await env.DB.prepare(sql).bind(...params).all();
      const anuncios = results.map((a) => ({ ...a, distancia_km: distancias[a.bairro_id] ?? null }))
        .sort((x, y) => (x.distancia_km ?? 99) - (y.distancia_km ?? 99));
      return json({ ok: true, anuncios });
    }

    const matchAnuncioId = pathname.match(/^\/anuncios\/([^/]+)$/);
    if (matchAnuncioId && request.method === 'GET') {
      const bairroVisitante = url.searchParams.get('bairro_id');
      const anuncio = await env.DB.prepare(
        `SELECT a.*, u.nome AS vendedor_nome, u.telefone AS vendedor_telefone, u.reputacao AS vendedor_reputacao,
                u.verificado AS vendedor_verificado, u.criado_em AS vendedor_desde, u.foto_url AS vendedor_foto,
                m.nome AS marca_nome, mo.nome AS modelo_nome, tp.nome AS tipo_peca_nome, b.nome AS bairro_nome, b.lat AS bairro_lat, b.lng AS bairro_lng
         FROM anuncios a JOIN users u ON u.id = a.vendedor_id
         JOIN marcas m ON m.id = a.marca_id JOIN modelos mo ON mo.id = a.modelo_id JOIN tipos_peca tp ON tp.id = a.tipo_peca_id
         JOIN bairros b ON b.id = a.bairro_id
         WHERE a.id = ?`
      ).bind(matchAnuncioId[1]).first();
      if (!anuncio) return json({ ok: false, erro: 'nao_encontrado' }, 404);
      let distanciaKmAtual = null;
      if (bairroVisitante && anuncio.bairro_lat != null) {
        const origem = await env.DB.prepare('SELECT lat, lng FROM bairros WHERE id = ?').bind(bairroVisitante).first();
        if (origem && origem.lat != null) distanciaKmAtual = Math.round(distanciaKm(origem.lat, origem.lng, anuncio.bairro_lat, anuncio.bairro_lng) * 10) / 10;
      }
      return json({ ok: true, anuncio: { ...anuncio, distancia_km: distanciaKmAtual } });
    }

    const matchVender = pathname.match(/^\/anuncios\/([^/]+)\/vender$/);
    if (matchVender && request.method === 'POST') {
      const sess = await autenticar(request, env);
      if (!sess) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const anuncio = await env.DB.prepare('SELECT * FROM anuncios WHERE id = ?').bind(matchVender[1]).first();
      if (!anuncio || anuncio.vendedor_id !== sess.id) return json({ ok: false, erro: 'nao_encontrado' }, 404);
      const bonusLimite = Number(env.VENDAS_PARA_BONUS || 20);
      await env.DB.prepare('INSERT INTO vendas (id, anuncio_id, vendedor_id) VALUES (?, ?, ?)').bind(uid(), anuncio.id, sess.id).run();
      const novoTotal = sess.vendas_confirmadas_total + 1;
      let ganhouBonus = false;
      if (novoTotal % bonusLimite === 0) {
        ganhouBonus = true;
        await env.DB.prepare('UPDATE users SET vendas_confirmadas_total = ?, saldo_creditos = saldo_creditos + 1 WHERE id = ?').bind(novoTotal, sess.id).run();
      } else {
        await env.DB.prepare('UPDATE users SET vendas_confirmadas_total = ? WHERE id = ?').bind(novoTotal, sess.id).run();
      }
      return json({ ok: true, vendas_confirmadas_total: novoTotal, ganhou_credito_bonus: ganhouBonus });
    }

    const matchPausar = pathname.match(/^\/anuncios\/([^/]+)\/pausar$/);
    if (matchPausar && request.method === 'POST') {
      const sess = await autenticar(request, env);
      if (!sess) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const anuncio = await env.DB.prepare('SELECT * FROM anuncios WHERE id = ?').bind(matchPausar[1]).first();
      if (!anuncio || anuncio.vendedor_id !== sess.id) return json({ ok: false, erro: 'nao_encontrado' }, 404);
      await env.DB.prepare("UPDATE anuncios SET status = 'pausado_manual' WHERE id = ?").bind(anuncio.id).run();
      return json({ ok: true });
    }

    const matchRenovar = pathname.match(/^\/anuncios\/([^/]+)\/renovar$/);
    if (matchRenovar && request.method === 'POST') {
      const sess = await autenticar(request, env);
      if (!sess) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const anterior = await env.DB.prepare('SELECT * FROM anuncios WHERE id = ?').bind(matchRenovar[1]).first();
      if (!anterior || anterior.vendedor_id !== sess.id) return json({ ok: false, erro: 'nao_encontrado' }, 404);
      if (sess.saldo_creditos < 1 && !sess.is_admin) return json({ ok: false, erro: 'sem_creditos' }, 402);
      const duracaoDias = Number(env.ANUNCIO_DURACAO_DIAS || 30);
      const id = uid();
      const operacoesRenovar = [
        env.DB.prepare(
          `INSERT INTO anuncios (id, vendedor_id, marca_id, modelo_id, tipo_peca_id, titulo, descricao, preco_centavos, fotos, bairro_id, status, expira_em, renovado_de)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativo', ?, ?)`
        ).bind(id, sess.id, anterior.marca_id, anterior.modelo_id, anterior.tipo_peca_id, anterior.titulo, anterior.descricao, anterior.preco_centavos, anterior.fotos, anterior.bairro_id, addDiasIso(duracaoDias), anterior.id),
      ];
      if (!sess.is_admin) operacoesRenovar.push(env.DB.prepare('UPDATE users SET saldo_creditos = saldo_creditos - 1 WHERE id = ?').bind(sess.id));
      await env.DB.batch(operacoesRenovar);
      const novo = await env.DB.prepare('SELECT * FROM anuncios WHERE id = ?').bind(id).first();
      return json({ ok: true, anuncio: novo }, 201);
    }

    const matchDenunciar = pathname.match(/^\/anuncios\/([^/]+)\/denunciar$/);
    if (matchDenunciar && request.method === 'POST') {
      const sess = await autenticar(request, env);
      if (!sess) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const { motivo, detalhes } = await request.json();
      if (!motivo) return json({ ok: false, erro: 'motivo_obrigatorio' }, 400);
      await env.DB.prepare(
        'INSERT INTO denuncias (id, anuncio_id, denunciante_id, motivo, detalhes) VALUES (?, ?, ?, ?, ?)'
      ).bind(uid(), matchDenunciar[1], sess.id, motivo, detalhes || '').run();
      return json({ ok: true }, 201);
    }

    if (pathname === '/anuncios/meus' && request.method === 'GET') {
      const sess = await autenticar(request, env);
      if (!sess) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const { results } = await env.DB.prepare(
        `SELECT a.*, m.nome AS marca_nome, mo.nome AS modelo_nome, tp.nome AS tipo_peca_nome
         FROM anuncios a JOIN marcas m ON m.id = a.marca_id JOIN modelos mo ON mo.id = a.modelo_id JOIN tipos_peca tp ON tp.id = a.tipo_peca_id
         WHERE a.vendedor_id = ? ORDER BY a.criado_em DESC`
      ).bind(sess.id).all();
      return json({ ok: true, anuncios: results });
    }

    // ---- perfil público do vendedor ----
    const matchUsuarioPublico = pathname.match(/^\/usuarios\/([^/]+)$/);
    if (matchUsuarioPublico && request.method === 'GET') {
      const u = await env.DB.prepare('SELECT id, nome, criado_em, reputacao, vendas_confirmadas_total, verificado, foto_url FROM users WHERE id = ?').bind(matchUsuarioPublico[1]).first();
      if (!u) return json({ ok: false, erro: 'nao_encontrado' }, 404);
      const [anunciosAtivos, av] = await Promise.all([
        env.DB.prepare("SELECT COUNT(*) AS n FROM anuncios WHERE vendedor_id = ? AND status = 'ativo'").bind(u.id).first(),
        env.DB.prepare('SELECT COUNT(*) AS n, AVG(nota) AS media FROM avaliacoes WHERE vendedor_id = ?').bind(u.id).first(),
      ]);
      return json({
        ok: true,
        usuario: {
          id: u.id, nome: u.nome, criado_em: u.criado_em, reputacao: u.reputacao,
          vendas_confirmadas_total: u.vendas_confirmadas_total, verificado: !!u.verificado, foto_url: u.foto_url || null,
          anuncios_ativos: anunciosAtivos.n, total_avaliacoes: av.n, media_avaliacoes: av.media ? Math.round(av.media * 10) / 10 : null,
        },
      });
    }
    const matchUsuarioAnuncios = pathname.match(/^\/usuarios\/([^/]+)\/anuncios$/);
    if (matchUsuarioAnuncios && request.method === 'GET') {
      const { results } = await env.DB.prepare(
        `SELECT a.*, m.nome AS marca_nome, mo.nome AS modelo_nome, tp.nome AS tipo_peca_nome
         FROM anuncios a JOIN marcas m ON m.id = a.marca_id JOIN modelos mo ON mo.id = a.modelo_id JOIN tipos_peca tp ON tp.id = a.tipo_peca_id
         WHERE a.vendedor_id = ? AND a.status = 'ativo' ORDER BY a.criado_em DESC LIMIT 100`
      ).bind(matchUsuarioAnuncios[1]).all();
      return json({ ok: true, anuncios: results });
    }
    const matchUsuarioAvaliacoes = pathname.match(/^\/usuarios\/([^/]+)\/avaliacoes$/);
    if (matchUsuarioAvaliacoes && request.method === 'GET') {
      const [{ results }, distribuicaoRaw] = await Promise.all([
        env.DB.prepare(
          `SELECT av.*, u.nome AS avaliador_nome FROM avaliacoes av JOIN users u ON u.id = av.avaliador_id
           WHERE av.vendedor_id = ? ORDER BY av.criado_em DESC LIMIT 100`
        ).bind(matchUsuarioAvaliacoes[1]).all(),
        env.DB.prepare('SELECT nota, COUNT(*) AS n FROM avaliacoes WHERE vendedor_id = ? GROUP BY nota').bind(matchUsuarioAvaliacoes[1]).all(),
      ]);
      const distribuicao = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const r of distribuicaoRaw.results) distribuicao[r.nota] = r.n;
      return json({ ok: true, avaliacoes: results, distribuicao });
    }

    // ---- avaliação (só quem conversou de fato pode avaliar, 1x por conversa) ----
    const matchAvaliar = pathname.match(/^\/conversas\/([^/]+)\/avaliar$/);
    if (matchAvaliar && request.method === 'POST') {
      const sess = await autenticar(request, env);
      if (!sess) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const conversa = await env.DB.prepare('SELECT * FROM conversas WHERE id = ?').bind(matchAvaliar[1]).first();
      if (!conversa || conversa.comprador_id !== sess.id) return json({ ok: false, erro: 'nao_encontrada' }, 404);
      const { nota, comentario } = await request.json();
      const notaNum = Number(nota);
      if (!Number.isInteger(notaNum) || notaNum < 1 || notaNum > 5) return json({ ok: false, erro: 'nota_invalida' }, 400);
      const jaExiste = await env.DB.prepare('SELECT id FROM avaliacoes WHERE conversa_id = ?').bind(conversa.id).first();
      if (jaExiste) return json({ ok: false, erro: 'ja_avaliado' }, 409);
      await env.DB.prepare(
        'INSERT INTO avaliacoes (id, conversa_id, vendedor_id, avaliador_id, nota, comentario) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(uid(), conversa.id, conversa.vendedor_id, sess.id, notaNum, (comentario || '').trim()).run();
      return json({ ok: true }, 201);
    }

    // ---- upload de foto (R2) ----
    if (pathname === '/upload-foto' && request.method === 'POST') {
      const sess = await autenticar(request, env);
      if (!sess) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const nomeArquivo = request.headers.get('X-File-Name') || 'foto.jpg';
      const chave = `${sess.id}/${uid()}-${nomeArquivo}`;
      const bytes = await request.arrayBuffer();
      if (bytes.byteLength > 8 * 1024 * 1024) return json({ ok: false, erro: 'arquivo_muito_grande' }, 413);
      await env.FOTOS.put(chave, bytes, { httpMetadata: { contentType: request.headers.get('Content-Type') || 'image/jpeg' } });
      return json({ ok: true, chave, url: `/foto/${chave}` }, 201);
    }
    if (pathname.startsWith('/foto/') && request.method === 'GET') {
      const chave = pathname.replace('/foto/', '');
      const obj = await env.FOTOS.get(chave);
      if (!obj) return new Response('Não encontrada.', { status: 404 });
      const headers = new Headers();
      obj.writeHttpMetadata(headers);
      headers.set('Cache-Control', 'public, max-age=31536000');
      return new Response(obj.body, { headers });
    }

    // ---- chat (comprador <-> vendedor, filtra telefone/whatsapp) ----
    if (pathname === '/conversas' && request.method === 'POST') {
      const sess = await autenticar(request, env);
      if (!sess) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const { anuncio_id } = await request.json();
      const anuncio = await env.DB.prepare('SELECT * FROM anuncios WHERE id = ?').bind(anuncio_id).first();
      if (!anuncio) return json({ ok: false, erro: 'anuncio_nao_encontrado' }, 404);
      if (anuncio.vendedor_id === sess.id) return json({ ok: false, erro: 'nao_pode_conversar_com_proprio_anuncio' }, 400);
      let conversa = await env.DB.prepare('SELECT * FROM conversas WHERE anuncio_id = ? AND comprador_id = ?').bind(anuncio_id, sess.id).first();
      if (!conversa) {
        const id = uid();
        await env.DB.prepare('INSERT INTO conversas (id, anuncio_id, comprador_id, vendedor_id) VALUES (?, ?, ?, ?)').bind(id, anuncio_id, sess.id, anuncio.vendedor_id).run();
        conversa = await env.DB.prepare('SELECT * FROM conversas WHERE id = ?').bind(id).first();
      }
      return json({ ok: true, conversa });
    }
    if (pathname === '/conversas' && request.method === 'GET') {
      const sess = await autenticar(request, env);
      if (!sess) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const { results } = await env.DB.prepare(
        `SELECT c.*, a.titulo AS anuncio_titulo,
                (SELECT texto FROM mensagens WHERE conversa_id = c.id ORDER BY criado_em DESC LIMIT 1) AS ultima_mensagem
         FROM conversas c JOIN anuncios a ON a.id = c.anuncio_id
         WHERE c.comprador_id = ? OR c.vendedor_id = ? ORDER BY c.criado_em DESC`
      ).bind(sess.id, sess.id).all();
      return json({ ok: true, conversas: results });
    }
    const matchConversaMsgs = pathname.match(/^\/conversas\/([^/]+)\/mensagens$/);
    if (matchConversaMsgs && request.method === 'GET') {
      const sess = await autenticar(request, env);
      if (!sess) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const conversa = await env.DB.prepare('SELECT * FROM conversas WHERE id = ?').bind(matchConversaMsgs[1]).first();
      if (!conversa || (conversa.comprador_id !== sess.id && conversa.vendedor_id !== sess.id)) return json({ ok: false, erro: 'nao_encontrada' }, 404);
      const { results } = await env.DB.prepare('SELECT * FROM mensagens WHERE conversa_id = ? ORDER BY criado_em ASC LIMIT 200').bind(conversa.id).all();
      return json({ ok: true, mensagens: results });
    }
    if (matchConversaMsgs && request.method === 'POST') {
      const sess = await autenticar(request, env);
      if (!sess) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const conversa = await env.DB.prepare('SELECT * FROM conversas WHERE id = ?').bind(matchConversaMsgs[1]).first();
      if (!conversa || (conversa.comprador_id !== sess.id && conversa.vendedor_id !== sess.id)) return json({ ok: false, erro: 'nao_encontrada' }, 404);
      const { texto } = await request.json();
      if (!texto || !texto.trim()) return json({ ok: false, erro: 'texto_obrigatorio' }, 400);
      const bloqueada = contemContatoExterno(texto);
      const textoFinal = bloqueada ? '[Mensagem bloqueada: não é permitido compartilhar telefone/WhatsApp pelo chat.]' : texto.trim();
      const id = uid();
      await env.DB.prepare('INSERT INTO mensagens (id, conversa_id, remetente_id, texto, bloqueada) VALUES (?, ?, ?, ?, ?)').bind(id, conversa.id, sess.id, textoFinal, bloqueada ? 1 : 0).run();
      return json({ ok: true, bloqueada, texto: textoFinal }, 201);
    }

    // ---- admin ----
    if (pathname === '/admin/denuncias' && request.method === 'GET') {
      const sess = await autenticar(request, env);
      if (!sess || !sess.is_admin) return json({ ok: false, erro: 'nao_autorizado' }, 401);
      const { results } = await env.DB.prepare(
        `SELECT d.*, a.titulo AS anuncio_titulo, a.vendedor_id, u.nome AS denunciante_nome
         FROM denuncias d JOIN anuncios a ON a.id = d.anuncio_id JOIN users u ON u.id = d.denunciante_id
         WHERE d.status = 'pendente' ORDER BY d.criado_em ASC`
      ).all();
      return json({ ok: true, denuncias: results });
    }
    const matchResolverDenuncia = pathname.match(/^\/admin\/denuncias\/([^/]+)\/resolver$/);
    if (matchResolverDenuncia && request.method === 'POST') {
      const sess = await autenticar(request, env);
      if (!sess || !sess.is_admin) return json({ ok: false, erro: 'nao_autorizado' }, 401);
      const { status, remover_anuncio, penalidade_reputacao } = await request.json();
      if (!['procedente', 'improcedente'].includes(status)) return json({ ok: false, erro: 'status_invalido' }, 400);
      const denuncia = await env.DB.prepare('SELECT * FROM denuncias WHERE id = ?').bind(matchResolverDenuncia[1]).first();
      if (!denuncia) return json({ ok: false, erro: 'nao_encontrada' }, 404);
      await env.DB.prepare("UPDATE denuncias SET status = ? WHERE id = ?").bind(status, denuncia.id).run();
      if (status === 'procedente') {
        const anuncio = await env.DB.prepare('SELECT * FROM anuncios WHERE id = ?').bind(denuncia.anuncio_id).first();
        if (remover_anuncio) await env.DB.prepare("UPDATE anuncios SET status = 'removido_admin' WHERE id = ?").bind(denuncia.anuncio_id).run();
        if (penalidade_reputacao) await env.DB.prepare('UPDATE users SET reputacao = MAX(0, reputacao - ?) WHERE id = ?').bind(penalidade_reputacao, anuncio.vendedor_id).run();
      }
      return json({ ok: true });
    }
    const matchVerificarUsuario = pathname.match(/^\/admin\/usuarios\/([^/]+)\/verificar$/);
    if (matchVerificarUsuario && request.method === 'POST') {
      const sess = await autenticar(request, env);
      if (!sess || !sess.is_admin) return json({ ok: false, erro: 'nao_autorizado' }, 401);
      const { verificado } = await request.json();
      await env.DB.prepare('UPDATE users SET verificado = ? WHERE id = ?').bind(verificado ? 1 : 0, matchVerificarUsuario[1]).run();
      return json({ ok: true });
    }
    if (pathname === '/admin/usuarios' && request.method === 'GET') {
      const sess = await autenticar(request, env);
      if (!sess || !sess.is_admin) return json({ ok: false, erro: 'nao_autorizado' }, 401);
      const { results } = await env.DB.prepare('SELECT id, nome, email, verificado, reputacao, criado_em FROM users ORDER BY criado_em DESC LIMIT 200').all();
      return json({ ok: true, usuarios: results });
    }
    if (pathname === '/admin/stats' && request.method === 'GET') {
      const sess = await autenticar(request, env);
      if (!sess || !sess.is_admin) return json({ ok: false, erro: 'nao_autorizado' }, 401);
      const [usuarios, anunciosAtivos, vendas, denunciasPendentes] = await Promise.all([
        env.DB.prepare('SELECT COUNT(*) AS n FROM users').first(),
        env.DB.prepare("SELECT COUNT(*) AS n FROM anuncios WHERE status = 'ativo'").first(),
        env.DB.prepare('SELECT COUNT(*) AS n FROM vendas').first(),
        env.DB.prepare("SELECT COUNT(*) AS n FROM denuncias WHERE status = 'pendente'").first(),
      ]);
      return json({ ok: true, usuarios: usuarios.n, anuncios_ativos: anunciosAtivos.n, vendas_totais: vendas.n, denuncias_pendentes: denunciasPendentes.n });
    }

    return json({ ok: false, erro: 'rota_nao_encontrada' }, 404);
  },
};
