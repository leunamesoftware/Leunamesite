-- Banco de licenças da LeuName Softwares (Cloudflare D1)
-- Serve todos os apps (LeuName Gestão e futuros), todos os idiomas.

CREATE TABLE IF NOT EXISTS apps (
  id TEXT PRIMARY KEY,        -- slug curto, ex: 'leuname-gestao'
  nome TEXT NOT NULL,         -- nome de exibição, ex: 'LeuName Gestão'
  criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS licencas (
  id TEXT PRIMARY KEY,              -- uuid gerado pelo Worker
  app_id TEXT NOT NULL,
  chave TEXT NOT NULL UNIQUE,       -- formato LEU-XXXX-XXXX-XXXX
  cliente_nome TEXT,
  cliente_contato TEXT,             -- e-mail, whatsapp, o que for
  origem TEXT NOT NULL DEFAULT 'manual',  -- manual | play_billing | site
  status TEXT NOT NULL DEFAULT 'ativa',   -- ativa | revogada
  criado_em TEXT NOT NULL,
  revogado_em TEXT,
  FOREIGN KEY (app_id) REFERENCES apps(id)
);

CREATE INDEX IF NOT EXISTS idx_licencas_app ON licencas(app_id);
CREATE INDEX IF NOT EXISTS idx_licencas_chave ON licencas(chave);

-- App inicial: LeuName Gestão
INSERT OR IGNORE INTO apps (id, nome, criado_em)
VALUES ('leuname-gestao', 'LeuName Gestão', datetime('now'));
