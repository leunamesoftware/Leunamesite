-- Fase 17: limite de requisições (janela fixa por chave) e exclusão de conta (LGPD).
CREATE TABLE rate_limits (
  key       TEXT PRIMARY KEY,
  count     INTEGER NOT NULL,
  reset_at  INTEGER NOT NULL
);
CREATE INDEX idx_rate_limits_reset ON rate_limits(reset_at);

ALTER TABLE users ADD COLUMN deleted_at TEXT;
