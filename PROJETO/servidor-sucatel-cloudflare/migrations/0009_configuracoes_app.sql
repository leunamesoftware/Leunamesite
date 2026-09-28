-- Sucatel — configurações simples do app que o admin pode trocar sem
-- precisar de um novo deploy (por enquanto: o banner da tela inicial).
CREATE TABLE IF NOT EXISTS configuracoes (
  chave TEXT PRIMARY KEY,
  valor TEXT,
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
