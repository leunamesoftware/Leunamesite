-- Sucatel — opção genérica pra lote, acessório sem marca, carregador
-- paralelo etc. (antes era obrigatório escolher marca+modelo específicos,
-- e quem não achava o seu na lista ficava sem conseguir anunciar).
INSERT OR IGNORE INTO marcas (id, nome, ordem) VALUES ('generico', 'Genérico / Várias marcas', 999);
INSERT OR IGNORE INTO modelos (id, marca_id, nome) VALUES ('generico-varios', 'generico', 'Vários / Não se aplica');
