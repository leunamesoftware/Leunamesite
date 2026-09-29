-- Sucatel — prazo extra que o admin dá num anúncio (cortesia pra cliente
-- bom, ou pra quem deixou vencer). "visto_em" = quando o vendedor viu o
-- aviso no app.
CREATE TABLE IF NOT EXISTS prorrogacoes (
  id TEXT PRIMARY KEY,
  anuncio_id TEXT NOT NULL REFERENCES anuncios(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  admin_id TEXT REFERENCES users(id),
  dias INTEGER NOT NULL,
  expira_em_novo TEXT NOT NULL,
  visto_em TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_prorrogacoes_user ON prorrogacoes(user_id, visto_em);
