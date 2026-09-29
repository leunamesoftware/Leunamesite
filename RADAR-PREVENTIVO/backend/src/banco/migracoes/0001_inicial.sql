-- Radar Preventivo — V1: estrutura inicial do banco.
-- Datas-hora em ISO 8601 UTC (ex.: 2026-10-01T11:00:00.000Z).
-- Datas de calendário (emissão, vencimento) em AAAA-MM-DD.

CREATE TABLE usuarios (
  id            TEXT PRIMARY KEY,
  nome          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  senha_hash    TEXT NOT NULL,
  tipo_conta    TEXT NOT NULL CHECK (tipo_conta IN ('pessoa', 'empresa')),
  -- Preparado para o painel administrativo futuro; na V1 todos são 'usuario'.
  papel         TEXT NOT NULL DEFAULT 'usuario' CHECK (papel IN ('usuario', 'administrador')),
  criado_em     TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE TABLE sessoes (
  id           TEXT PRIMARY KEY,
  usuario_id   TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  -- Só o hash (SHA-256) da credencial fica guardado; a credencial em si vai só para o aparelho.
  token_hash   TEXT NOT NULL UNIQUE,
  criado_em    TEXT NOT NULL,
  expira_em    TEXT NOT NULL,
  encerrada_em TEXT
);
CREATE INDEX idx_sessoes_usuario ON sessoes(usuario_id);

CREATE TABLE tentativas_login (
  id           TEXT PRIMARY KEY,
  identificador TEXT NOT NULL, -- e-mail ou IP
  sucesso      INTEGER NOT NULL,
  criado_em    TEXT NOT NULL
);
CREATE INDEX idx_tentativas_ident ON tentativas_login(identificador, criado_em);

CREATE TABLE itens (
  id                TEXT PRIMARY KEY,
  usuario_id        TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  natureza          TEXT NOT NULL CHECK (natureza IN ('documento', 'prazo')),
  titulo            TEXT NOT NULL,
  tipo              TEXT NOT NULL,             -- texto livre
  descricao         TEXT,
  data_emissao      TEXT,                      -- AAAA-MM-DD
  data_vencimento   TEXT,                      -- AAAA-MM-DD
  antecedencia_dias INTEGER,                   -- substitui os 30 dias só neste item
  estado            TEXT NOT NULL DEFAULT 'ativo' CHECK (estado IN ('ativo', 'resolvido', 'arquivado')),
  resolvido_em      TEXT,
  -- Preparado para leitura automática futura (IA/OCR); na V1 sempre 'manual'.
  origem_dados      TEXT NOT NULL DEFAULT 'manual' CHECK (origem_dados IN ('manual', 'automatica')),
  criado_em         TEXT NOT NULL,
  atualizado_em     TEXT NOT NULL
);
CREATE INDEX idx_itens_usuario ON itens(usuario_id, estado);
CREATE INDEX idx_itens_vencimento ON itens(estado, data_vencimento);

CREATE TABLE anexos (
  id               TEXT PRIMARY KEY,
  item_id          TEXT NOT NULL REFERENCES itens(id) ON DELETE CASCADE,
  usuario_id       TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  chave_arquivo    TEXT NOT NULL UNIQUE,       -- onde o arquivo está no armazenamento
  nome             TEXT NOT NULL,
  formato          TEXT NOT NULL,              -- tipo MIME
  tamanho_bytes    INTEGER NOT NULL,
  -- Preparado para IA/OCR; na V1 sempre 'nao_processado'.
  situacao_leitura TEXT NOT NULL DEFAULT 'nao_processado',
  criado_em        TEXT NOT NULL
);
CREATE INDEX idx_anexos_item ON anexos(item_id);

-- Resultado mais recente da análise de cada item.
CREATE TABLE analises (
  item_id        TEXT PRIMARY KEY REFERENCES itens(id) ON DELETE CASCADE,
  situacao       TEXT NOT NULL CHECK (situacao IN ('sem_prazo', 'em_dia', 'atencao', 'urgente', 'vence_hoje', 'vencido')),
  dias_restantes INTEGER,
  pendencias     TEXT NOT NULL DEFAULT '[]',   -- lista JSON
  analisado_em   TEXT NOT NULL,
  versao_regras  TEXT NOT NULL
);

CREATE TABLE alertas (
  id           TEXT PRIMARY KEY,
  usuario_id   TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  item_id      TEXT NOT NULL REFERENCES itens(id) ON DELETE CASCADE,
  motivo       TEXT NOT NULL CHECK (motivo IN ('mudou_situacao', 'lembrete_vencido')),
  situacao     TEXT NOT NULL,
  mensagem     TEXT NOT NULL,
  -- Impede o mesmo alerta de nascer duas vezes.
  chave_unica  TEXT NOT NULL UNIQUE,
  criado_em    TEXT NOT NULL,
  lido_em      TEXT,
  resolvido_em TEXT
);
CREATE INDEX idx_alertas_usuario ON alertas(usuario_id, lido_em);
CREATE INDEX idx_alertas_item ON alertas(item_id);

-- Por qual canal cada alerta foi entregue. Na V1 só existe o canal 'app';
-- push e e-mail entram aqui no futuro sem mudar a regra dos alertas.
CREATE TABLE entregas_alerta (
  id          TEXT PRIMARY KEY,
  alerta_id   TEXT NOT NULL REFERENCES alertas(id) ON DELETE CASCADE,
  canal       TEXT NOT NULL,
  status      TEXT NOT NULL,                   -- 'entregue' | 'falhou'
  criado_em   TEXT NOT NULL
);
CREATE INDEX idx_entregas_alerta ON entregas_alerta(alerta_id);
