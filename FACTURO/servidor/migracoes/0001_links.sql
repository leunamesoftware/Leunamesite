-- Cópia do documento que o cliente vê pelo link. Guardamos só o necessário.
CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,              -- aparece na URL (aleatório, 16 caracteres)
  chave_hash TEXT NOT NULL,         -- SHA-256 da chave do dono (o app guarda a chave)
  dados TEXT NOT NULL,              -- JSON com a cópia pública do documento
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL,
  expira_em TEXT NOT NULL,
  ip_hash TEXT,                     -- para limitar abuso (não guardamos o IP)
  visto_em TEXT,
  aprovacao TEXT,                   -- JSON {nome, assinatura, em}
  recusado INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_links_expira ON links(expira_em);
CREATE INDEX IF NOT EXISTS idx_links_ip ON links(ip_hash, criado_em);
