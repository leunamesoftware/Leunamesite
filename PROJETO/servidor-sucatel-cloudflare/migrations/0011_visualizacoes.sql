-- Sucatel — contador real de visualizações por anúncio (aparece no painel
-- admin; antes não existia, então o painel não mostrava esse número).
ALTER TABLE anuncios ADD COLUMN visualizacoes INTEGER NOT NULL DEFAULT 0;
