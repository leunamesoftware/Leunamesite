-- Sucatel — histórico de créditos dados/tirados pelo admin (bônus pra
-- cliente que anuncia/vende bastante, cortesia, correção). "visto_em"
-- marca quando o cliente viu o aviso do bônus no app.
CREATE TABLE IF NOT EXISTS ajustes_creditos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  admin_id TEXT REFERENCES users(id),
  quantidade INTEGER NOT NULL,
  motivo TEXT NOT NULL DEFAULT '',
  visto_em TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ajustes_creditos_user ON ajustes_creditos(user_id, criado_em);
