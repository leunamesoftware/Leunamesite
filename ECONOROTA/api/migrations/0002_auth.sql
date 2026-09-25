-- Fase 2 — acesso do cliente: verificação, recuperação de senha, login Google.

ALTER TABLE users ADD COLUMN phone_verified_at TEXT;
ALTER TABLE users ADD COLUMN google_sub TEXT;
ALTER TABLE users ADD COLUMN accepted_terms_at TEXT;

-- Telefone e conta Google são únicos quando informados.
CREATE UNIQUE INDEX idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX idx_users_google ON users(google_sub) WHERE google_sub IS NOT NULL;

-- Códigos de 6 dígitos (guardados apenas como hash).
CREATE TABLE verification_codes (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose      TEXT NOT NULL CHECK (purpose IN ('verify','reset')),
  channel      TEXT NOT NULL CHECK (channel IN ('email','whatsapp')),
  code_hash    TEXT NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  expires_at   TEXT NOT NULL,
  consumed_at  TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_codes_user ON verification_codes(user_id, purpose, created_at);

CREATE INDEX idx_audit_action ON audit_logs(action, entity_id, created_at);
