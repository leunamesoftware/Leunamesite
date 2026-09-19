// Banco SQLite local do serviço de licenças (não confundir com o banco
// local de cada loja, que é o IndexedDB dentro do próprio app.html).
// Este é o banco DA LEUNAME SOFTWARES, que guarda quais licenças existem
// e quais dispositivos estão autorizados em cada uma.

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'licenses.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS licenses (
  id TEXT PRIMARY KEY,
  license_key TEXT UNIQUE NOT NULL,
  loja_nome TEXT NOT NULL,
  responsavel_email TEXT,
  max_devices INTEGER NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'active', -- active | revoked | expired
  created_at TEXT NOT NULL,
  expires_at TEXT -- NULL = pagamento único, sem expiração
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  license_id TEXT NOT NULL REFERENCES licenses(id),
  device_key TEXT NOT NULL, -- fingerprint gerado pelo app cliente
  nome TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active | revoked
  activated_at TEXT NOT NULL,
  last_seen_at TEXT,
  UNIQUE(license_id, device_key)
);

CREATE INDEX IF NOT EXISTS idx_devices_license ON devices(license_id);
`);

module.exports = db;
