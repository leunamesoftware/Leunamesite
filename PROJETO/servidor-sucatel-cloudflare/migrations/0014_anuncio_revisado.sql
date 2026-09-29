-- Sucatel — o admin marca que analisou um anúncio ("Aprovar"): os que
-- ainda não foram olhados aparecem como "Para revisar" no painel.
-- O anúncio continua indo pro ar na hora (o cliente já pagou); isso só
-- organiza a análise do admin.
ALTER TABLE anuncios ADD COLUMN revisado_em TEXT;
