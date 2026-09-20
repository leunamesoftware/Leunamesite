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

-- Sincronização de dados entre dispositivos que compartilham a mesma
-- licença (até LICENSE_MAX_DEVICES_DEFAULT aparelhos). Cada registro do
-- app (produto, cliente, venda, etc.) vira uma linha aqui, identificada
-- pela chave de licença + nome da "gaveta" local (store) + id do
-- registro. "last write wins": só sobrescreve se atualizado_em for mais
-- novo que o que já está salvo.
CREATE TABLE IF NOT EXISTS sync_registros (
  chave TEXT NOT NULL,          -- chave de licença (LEU-XXXX-XXXX-XXXX), namespace da sincronização
  store TEXT NOT NULL,          -- nome da gaveta local (produtos, clientes, vendas, ...)
  registro_id TEXT NOT NULL,    -- id do registro dentro da gaveta
  payload TEXT,                 -- JSON do registro (nulo quando deletado=1)
  atualizado_em INTEGER NOT NULL, -- epoch ms de quando essa versão foi salva no dispositivo de origem
  deletado INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (chave, store, registro_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_chave_atualizado ON sync_registros(chave, atualizado_em);
