-- Sucatel — cada celular/placa anunciado leva o IMEI do aparelho: um
-- anúncio = uma unidade. Quando vende, o vendedor dá baixa (status
-- 'vendido') e o anúncio sai da loja; outra unidade = outro anúncio com
-- outro IMEI. O mesmo IMEI não pode estar em dois anúncios no ar.
ALTER TABLE anuncios ADD COLUMN imei TEXT;
ALTER TABLE anuncios ADD COLUMN vendido_em TEXT;
CREATE INDEX IF NOT EXISTS idx_anuncios_imei ON anuncios(imei);

-- Quais categorias pedem IMEI (o admin liga/desliga no painel).
ALTER TABLE tipos_peca ADD COLUMN exige_imei INTEGER NOT NULL DEFAULT 0;
UPDATE tipos_peca SET exige_imei = 1 WHERE id IN ('celular', 'placa');
