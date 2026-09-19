// LeuName License Server — serviço mínimo de ativação/validação de licenças.
//
// Este é um SCAFFOLD REAL (não simulado): roda, persiste em SQLite, assina
// tokens com HMAC, tem rate limiting básico. O que falta antes de produção
// está documentado no README.md da pasta.
//
// Fluxo (espelha o §12 do briefing):
//   1. LeuName gera uma chave de licença para a loja (script cli.js).
//   2. No primeiro acesso, o app cliente chama POST /activate com a chave
//      e um "device_key" (fingerprint do navegador/dispositivo).
//   3. Servidor confere se a licença está ativa e se ainda há vaga de
//      dispositivo (padrão: até 4, configurável por licença).
//   4. Servidor devolve um token assinado (HMAC) com validade curta.
//   5. O app guarda o token localmente e continua funcionando OFFLINE
//      normalmente — só precisa revalidar (POST /validate) quando tiver
//      internet, para renovar o token antes dele expirar.
//   6. Se o lojista trocar de aparelho, o administrador desautoriza o
//      dispositivo antigo (POST /deactivate-device, autenticado) e ativa
//      o novo — sem penalizar o cliente legítimo.

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const db = require('./db');
const { sign, verify } = require('./hmac');

const app = express();
app.use(helmet());
app.use(express.json({ limit: '32kb' }));

// Limite geral: evita força-bruta de chaves de licença.
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 60 }));

const ADMIN_SECRET = process.env.ADMIN_SECRET;
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 dias — app revalida antes disso quando online

function requireAdmin(req, res, next) {
  if (!ADMIN_SECRET) {
    return res.status(500).json({ error: 'servidor_mal_configurado', message: 'ADMIN_SECRET não definido.' });
  }
  const got = req.header('x-admin-secret');
  if (!got || got !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'nao_autorizado' });
  }
  next();
}

function licenseByKey(key) {
  return db.prepare('SELECT * FROM licenses WHERE license_key = ?').get(key);
}

function activeDeviceCount(licenseId) {
  return db.prepare(
    "SELECT COUNT(*) AS n FROM devices WHERE license_id = ? AND status = 'active'"
  ).get(licenseId).n;
}

// ---------------------------------------------------------------------
// POST /activate — ativa (ou reativa) um dispositivo para uma licença.
// body: { licenseKey, deviceKey, deviceName, lojaNome }
// ---------------------------------------------------------------------
app.post('/activate', (req, res) => {
  const { licenseKey, deviceKey, deviceName } = req.body || {};
  if (!licenseKey || !deviceKey) {
    return res.status(400).json({ error: 'dados_invalidos', message: 'licenseKey e deviceKey são obrigatórios.' });
  }

  const lic = licenseByKey(String(licenseKey).trim().toUpperCase());
  if (!lic) return res.status(404).json({ error: 'licenca_nao_encontrada' });
  if (lic.status !== 'active') return res.status(403).json({ error: 'licenca_inativa', status: lic.status });
  if (lic.expires_at && new Date(lic.expires_at).getTime() < Date.now()) {
    return res.status(403).json({ error: 'licenca_expirada' });
  }

  const existing = db.prepare(
    'SELECT * FROM devices WHERE license_id = ? AND device_key = ?'
  ).get(lic.id, deviceKey);

  const now = new Date().toISOString();

  if (existing) {
    if (existing.status !== 'active') {
      return res.status(403).json({ error: 'dispositivo_revogado', message: 'Peça ao administrador para reautorizar este dispositivo.' });
    }
    db.prepare('UPDATE devices SET last_seen_at = ?, nome = COALESCE(?, nome) WHERE id = ?')
      .run(now, deviceName || null, existing.id);
  } else {
    const activeCount = activeDeviceCount(lic.id);
    if (activeCount >= lic.max_devices) {
      return res.status(403).json({
        error: 'limite_dispositivos',
        message: `Esta licença já possui ${activeCount} de ${lic.max_devices} dispositivos autorizados. Desautorize um dispositivo antigo em Configurações > Dispositivos antes de ativar um novo.`,
      });
    }
    db.prepare(
      'INSERT INTO devices (id, license_id, device_key, nome, status, activated_at, last_seen_at) VALUES (?,?,?,?,?,?,?)'
    ).run(crypto.randomUUID(), lic.id, deviceKey, deviceName || null, 'active', now, now);
  }

  const token = sign({
    licenseId: lic.id,
    licenseKey: lic.license_key,
    deviceKey,
    lojaNome: lic.loja_nome,
    maxDevices: lic.max_devices,
    exp: Date.now() + TOKEN_TTL_MS,
  });

  res.json({ ok: true, token, lojaNome: lic.loja_nome, maxDevices: lic.max_devices });
});

// ---------------------------------------------------------------------
// POST /validate — revalida um token existente (chamado periodicamente
// pelo app quando há internet; o app continua funcionando offline entre
// as revalidações, dentro da validade do token).
// body: { token }
// ---------------------------------------------------------------------
app.post('/validate', (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ valid: false, reason: 'token_ausente' });

  const result = verify(token);
  if (!result.ok) return res.json({ valid: false, reason: result.reason });

  const lic = db.prepare('SELECT * FROM licenses WHERE id = ?').get(result.data.licenseId);
  if (!lic || lic.status !== 'active') {
    return res.json({ valid: false, reason: 'licenca_inativa' });
  }
  const dev = db.prepare(
    'SELECT * FROM devices WHERE license_id = ? AND device_key = ?'
  ).get(lic.id, result.data.deviceKey);
  if (!dev || dev.status !== 'active') {
    return res.json({ valid: false, reason: 'dispositivo_revogado' });
  }

  db.prepare('UPDATE devices SET last_seen_at = ? WHERE id = ?').run(new Date().toISOString(), dev.id);

  // Emite um token renovado, estendendo a validade offline.
  const newToken = sign({
    licenseId: lic.id,
    licenseKey: lic.license_key,
    deviceKey: dev.device_key,
    lojaNome: lic.loja_nome,
    maxDevices: lic.max_devices,
    exp: Date.now() + TOKEN_TTL_MS,
  });

  res.json({ valid: true, token: newToken });
});

// ---------------------------------------------------------------------
// POST /deactivate-device — administrador da loja desautoriza um
// dispositivo (ex.: notebook antigo quebrado) para liberar vaga.
// Autenticado com a própria licença (não expõe endpoint público de admin
// geral da LeuName nesta V1, conforme §12 do briefing).
// body: { licenseKey, deviceKey, requesterDeviceKey, requesterToken }
// ---------------------------------------------------------------------
app.post('/deactivate-device', (req, res) => {
  const { licenseKey, deviceKey, requesterToken } = req.body || {};
  if (!licenseKey || !deviceKey || !requesterToken) {
    return res.status(400).json({ error: 'dados_invalidos' });
  }
  const check = verify(requesterToken);
  if (!check.ok) return res.status(401).json({ error: 'token_invalido' });

  const lic = licenseByKey(String(licenseKey).trim().toUpperCase());
  if (!lic || lic.id !== check.data.licenseId) {
    return res.status(403).json({ error: 'licenca_nao_corresponde' });
  }

  const dev = db.prepare('SELECT * FROM devices WHERE license_id = ? AND device_key = ?').get(lic.id, deviceKey);
  if (!dev) return res.status(404).json({ error: 'dispositivo_nao_encontrado' });

  db.prepare("UPDATE devices SET status = 'revoked' WHERE id = ?").run(dev.id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------
// Endpoints administrativos internos da LeuName (protegidos por
// ADMIN_SECRET) — para o time da LeuName emitir/consultar licenças sem
// precisar de um painel dentro do próprio app (§12: sem painel master na V1).
// ---------------------------------------------------------------------
app.post('/admin/licenses', requireAdmin, (req, res) => {
  const { lojaNome, responsavelEmail, maxDevices } = req.body || {};
  if (!lojaNome) return res.status(400).json({ error: 'loja_nome_obrigatorio' });
  const id = crypto.randomUUID();
  const key = generateLicenseKey();
  db.prepare(
    'INSERT INTO licenses (id, license_key, loja_nome, responsavel_email, max_devices, status, created_at) VALUES (?,?,?,?,?,?,?)'
  ).run(id, key, lojaNome, responsavelEmail || null, maxDevices || 4, 'active', new Date().toISOString());
  res.json({ ok: true, licenseKey: key, id });
});

app.get('/admin/licenses/:key/devices', requireAdmin, (req, res) => {
  const lic = licenseByKey(req.params.key.toUpperCase());
  if (!lic) return res.status(404).json({ error: 'licenca_nao_encontrada' });
  const devices = db.prepare('SELECT * FROM devices WHERE license_id = ?').all(lic.id);
  res.json({ license: lic, devices });
});

app.post('/admin/licenses/:key/revoke', requireAdmin, (req, res) => {
  const lic = licenseByKey(req.params.key.toUpperCase());
  if (!lic) return res.status(404).json({ error: 'licenca_nao_encontrada' });
  db.prepare("UPDATE licenses SET status = 'revoked' WHERE id = ?").run(lic.id);
  res.json({ ok: true });
});

function generateLicenseKey() {
  const block = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  return `LEU-${block()}-${block()}-${block()}`;
}

app.get('/health', (req, res) => res.json({ ok: true, service: 'leuname-license-server' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`LeuName License Server rodando na porta ${PORT}`));
