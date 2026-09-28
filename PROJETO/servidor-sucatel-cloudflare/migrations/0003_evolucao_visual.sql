-- Sucatel — evolução pra dar suporte de verdade às telas de referência:
-- coordenadas reais de bairro (busca por região com distância real, não só
-- bairro exato), condição do anúncio, categorias mais completas (celular
-- inteiro, acessórios, capinhas, fones, smartwatches, tablets) e avaliações
-- reais entre comprador e vendedor (uma por conversa, depois do contato).

ALTER TABLE bairros ADD COLUMN lat REAL;
ALTER TABLE bairros ADD COLUMN lng REAL;

UPDATE bairros SET lat = -22.5667, lng = -43.2833 WHERE id = 'xerem';
UPDATE bairros SET lat = -22.5700, lng = -43.2800 WHERE id = 'mantiqueira-xerem';
UPDATE bairros SET lat = -22.6000, lng = -43.3100 WHERE id = 'santa-cruz-da-serra';
UPDATE bairros SET lat = -22.7858, lng = -43.3117 WHERE id = 'centro-caxias';
UPDATE bairros SET lat = -22.7556, lng = -43.4506 WHERE id = 'centro-nova-iguacu';
UPDATE bairros SET lat = -22.9556, lng = -43.3653 WHERE id = 'jacarepagua';
UPDATE bairros SET lat = -22.9019, lng = -43.5631 WHERE id = 'campo-grande';
UPDATE bairros SET lat = -22.8039, lng = -43.3722 WHERE id = 'centro-meriti';
UPDATE bairros SET lat = -22.7642, lng = -43.3994 WHERE id = 'centro-belford-roxo';
UPDATE bairros SET lat = -22.7500, lng = -43.4100 WHERE id = 'lote-xv';

ALTER TABLE users ADD COLUMN verificado INTEGER NOT NULL DEFAULT 0;

ALTER TABLE anuncios ADD COLUMN condicao TEXT NOT NULL DEFAULT 'usado'; -- novo | usado | com_defeito | sucata

ALTER TABLE tipos_peca ADD COLUMN grupo TEXT;
UPDATE tipos_peca SET grupo = id WHERE id IN ('tela', 'bateria', 'camera', 'placa', 'outro');
UPDATE tipos_peca SET grupo = 'peca' WHERE id IN ('carcaca', 'alto-falante', 'conector-carga', 'vidro-traseiro', 'flex');

INSERT OR IGNORE INTO tipos_peca (id, nome, ordem, grupo) VALUES
 ('celular', 'Celulares', 0, 'celular'),
 ('acessorio', 'Acessório (carregador/cabo)', 60, 'acessorio'),
 ('capinha', 'Capinha', 70, 'capinha'),
 ('fone-ouvido', 'Fone de ouvido', 80, 'fone-ouvido'),
 ('smartwatch', 'Smartwatch', 90, 'smartwatch'),
 ('tablet', 'Tablet', 95, 'tablet');

-- Avaliação real: só quem de fato conversou com o vendedor sobre aquele
-- anúncio (comprador da conversa) pode avaliar, uma vez por conversa.
CREATE TABLE IF NOT EXISTS avaliacoes (
  id TEXT PRIMARY KEY,
  conversa_id TEXT NOT NULL UNIQUE REFERENCES conversas(id),
  vendedor_id TEXT NOT NULL REFERENCES users(id),
  avaliador_id TEXT NOT NULL REFERENCES users(id),
  nota INTEGER NOT NULL,
  comentario TEXT NOT NULL DEFAULT '',
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_vendedor ON avaliacoes(vendedor_id);
