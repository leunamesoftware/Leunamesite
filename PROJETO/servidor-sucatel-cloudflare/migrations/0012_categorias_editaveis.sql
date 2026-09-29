-- Sucatel — categorias editáveis pelo painel admin: ícone próprio (emoji)
-- e poder ocultar uma categoria da loja sem apagar os anúncios dela.
ALTER TABLE tipos_peca ADD COLUMN icone TEXT;
ALTER TABLE tipos_peca ADD COLUMN ativo INTEGER NOT NULL DEFAULT 1;

-- Mesmos ícones que a loja já usava fixos no código.
UPDATE tipos_peca SET icone = '📱' WHERE id = 'celular';
UPDATE tipos_peca SET icone = '🔲' WHERE id = 'tela';
UPDATE tipos_peca SET icone = '🖲️' WHERE id = 'placa';
UPDATE tipos_peca SET icone = '🔋' WHERE id = 'bateria';
UPDATE tipos_peca SET icone = '🛠️' WHERE id = 'carcaca';
UPDATE tipos_peca SET icone = '📷' WHERE id = 'camera';
UPDATE tipos_peca SET icone = '🔊' WHERE id = 'alto-falante';
UPDATE tipos_peca SET icone = '🔌' WHERE id = 'conector-carga';
UPDATE tipos_peca SET icone = '🪟' WHERE id = 'vidro-traseiro';
UPDATE tipos_peca SET icone = '➰' WHERE id = 'flex';
UPDATE tipos_peca SET icone = '📦' WHERE id = 'outro';
UPDATE tipos_peca SET icone = '🔌' WHERE id = 'acessorio';
UPDATE tipos_peca SET icone = '🛡️' WHERE id = 'capinha';
UPDATE tipos_peca SET icone = '🎧' WHERE id = 'fone-ouvido';
UPDATE tipos_peca SET icone = '⌚' WHERE id = 'smartwatch';
UPDATE tipos_peca SET icone = '📓' WHERE id = 'tablet';
UPDATE tipos_peca SET icone = '📦' WHERE id = 'lote';
