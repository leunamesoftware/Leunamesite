-- Dados de demonstração (somente desenvolvimento local). Só o dono do SuperMais entra no painel: m1@demo.local / demo1234.
INSERT OR IGNORE INTO users (id, name, email, password_hash, role, status) VALUES
  ('u-m1','SuperMais','m1@demo.local','x','mercado','ativo'),
  ('u-m2','EconoMarket','m2@demo.local','x','mercado','ativo'),
  ('u-m3','Mercado Central','m3@demo.local','x','mercado','ativo'),
  ('u-m4','Bom Preço','m4@demo.local','x','mercado','ativo'),
  ('u-m5','RedeFácil','m5@demo.local','x','mercado','ativo');

INSERT OR IGNORE INTO markets (id, owner_user_id, name, address, district, city, state, lat, lng, rating, rating_count, is_open, status, delivery_fee_cents, min_order_cents, eta_min, eta_max, opens_at, closes_at) VALUES
  ('m1','u-m1','SuperMais','Rua Augusta, 900','Consolação','São Paulo','SP',-23.5540,-46.6580,4.8,1230,1,'ativo',590,3000,20,30,'07:00','23:00'),
  ('m2','u-m2','EconoMarket','Av. Paulista, 1500','Bela Vista','São Paulo','SP',-23.5610,-46.6560,4.6,980,1,'ativo',490,2000,25,35,'07:00','22:00'),
  ('m3','u-m3','Mercado Central','Rua da Consolação, 2100','Consolação','São Paulo','SP',-23.5520,-46.6620,4.7,560,1,'ativo',690,3000,30,40,'06:30','22:00'),
  ('m4','u-m4','Bom Preço','Av. Liberdade, 300','Liberdade','São Paulo','SP',-23.5580,-46.6350,4.5,430,1,'ativo',590,2000,35,45,'07:00','21:00'),
  ('m5','u-m5','RedeFácil','Rua Vergueiro, 1200','Paraíso','São Paulo','SP',-23.5720,-46.6400,4.4,320,1,'ativo',690,2500,35,50,'07:00','20:00');

INSERT OR IGNORE INTO products (id, market_id, category_id, name, brand, unit, price_cents, promo_price_cents, stock) VALUES
  ('p1','m1','hortifruti','Banana Prata',NULL,'1 kg',699,499,40),
  ('p2','m2','hortifruti','Tomate',NULL,'1 kg',599,449,30),
  ('p3','m3','mercearia','Arroz Tipo 1','Marca da Casa','5 kg',3190,2590,18),
  ('p4','m4','mercearia','Óleo de Soja',NULL,'900 ml',799,619,25),
  ('p5','m1','carnes','Alcatra Bovina',NULL,'1 kg',4990,3490,12),
  ('p6','m2','laticinios','Leite Integral',NULL,'1 L',599,449,50),
  ('p7','m3','hortifruti','Ovos Brancos',NULL,'dúzia',999,799,20),
  ('p8','m4','padaria','Pão Francês',NULL,'1 kg',1690,NULL,15),
  ('p9','m1','mercearia','Arroz Tipo 1','Marca da Casa','5 kg',2890,2490,10),
  ('p10','m2','mercearia','Feijão Carioca',NULL,'1 kg',899,NULL,22),
  ('p11','m5','mercearia','Arroz Integral',NULL,'1 kg',899,790,14),
  ('p12','m3','limpeza','Detergente Neutro',NULL,'500 ml',279,NULL,0),
  ('p13','m4','bebidas','Suco de Laranja',NULL,'1 L',1099,899,9),
  ('p14','m5','congelados','Pão de Queijo',NULL,'1 kg',2490,1990,7),
  ('p15','m1','higiene','Sabonete',NULL,'85 g',299,NULL,60),
  ('p16','m2','mercearia','Café Torrado',NULL,'500 g',2490,1790,11),
  ('p17','m2','hortifruti','Banana Prata',NULL,'1 kg',599,549,25),
  ('p18','m4','hortifruti','Banana Prata',NULL,'1 kg',649,NULL,3),
  ('p19','m1','laticinios','Leite Integral',NULL,'1 L',529,NULL,40),
  ('p20','m2','mercearia','Óleo de Soja',NULL,'900 ml',749,699,18),
  ('p21','m3','carnes','Alcatra Bovina',NULL,'1 kg',4590,3990,6),
  ('p22','m1','hortifruti','Ovos Brancos',NULL,'dúzia',949,NULL,30),
  ('p23','m1','hortifruti','Maçã Gala',NULL,'1 kg',890,750,35),
  ('p24','m1','hortifruti','Laranja Pera',NULL,'1 kg',550,450,40),
  ('p25','m1','hortifruti','Alface Crespa',NULL,'1 un',300,240,20),
  ('p26','m1','hortifruti','Cenoura',NULL,'1 kg',450,380,28),
  ('p27','m1','hortifruti','Batata Inglesa',NULL,'1 kg',590,480,50),
  ('p28','m1','hortifruti','Cebola',NULL,'1 kg',520,440,45),
  ('p29','m1','hortifruti','Alho',NULL,'100 g',350,299,30),
  ('p30','m1','hortifruti','Cheiro-Verde',NULL,'1 maço',250,199,15),
  ('p31','m2','hortifruti','Maçã Gala',NULL,'1 kg',790,NULL,20),
  ('p32','m3','hortifruti','Batata Inglesa',NULL,'1 kg',549,NULL,30);

UPDATE products SET compare_key = lower(trim(name)) || '|' || lower(replace(unit, ' ', '')) WHERE compare_key IS NULL;
UPDATE products SET description = 'Banana prata selecionada, madura no ponto. Vendida por quilo.' WHERE id = 'p1';
UPDATE products SET description = 'Arroz branco tipo 1, grãos longos e soltinhos.' WHERE id IN ('p3','p9');

INSERT OR IGNORE INTO users (id, name, email, password_hash, role, status) VALUES
  ('u-c1','Ana Souza','c1@demo.local','x','cliente','ativo'),
  ('u-c2','Bruno Lima','c2@demo.local','x','cliente','ativo'),
  ('u-c3','Carla Dias','c3@demo.local','x','cliente','ativo');
INSERT OR IGNORE INTO market_reviews (id, market_id, user_id, rating, comment, created_at) VALUES
  ('r1','m1','u-c1',5,'Entrega rápida e produtos bem escolhidos.','2026-09-20T18:00:00Z'),
  ('r2','m1','u-c2',4,'Faltou um item, mas avisaram antes e deram opção de troca.','2026-09-18T12:00:00Z'),
  ('r3','m1','u-c3',5,'Frutas e verduras sempre fresquinhas.','2026-09-15T10:00:00Z'),
  ('r4','m2','u-c1',4,'Bons preços nas ofertas da semana.','2026-09-19T16:00:00Z');

UPDATE products SET compare_key = lower(trim(name)) || '|' || lower(replace(unit, ' ', '')) WHERE compare_key IS NULL;
UPDATE products SET subcategory = 'Frutas' WHERE name IN ('Banana Prata','Maçã Gala','Laranja Pera');
UPDATE products SET subcategory = 'Verduras' WHERE name IN ('Alface Crespa');
UPDATE products SET subcategory = 'Legumes' WHERE name IN ('Tomate','Cenoura','Batata Inglesa','Cebola');
UPDATE products SET subcategory = 'Temperos' WHERE name IN ('Alho','Cheiro-Verde');
UPDATE products SET subcategory = 'Ovos' WHERE name = 'Ovos Brancos';
UPDATE products SET subcategory = 'Grãos' WHERE name IN ('Arroz Tipo 1','Arroz Integral','Feijão Carioca');
UPDATE products SET description = 'Banana prata fresca, madura no ponto. Ótima para lanches, vitaminas e receitas.' WHERE name = 'Banana Prata';

-- Cesta de comparação (Fase 5): mesmos produtos em vários mercados.
INSERT OR IGNORE INTO products (id, market_id, category_id, name, unit, price_cents, stock, subcategory) VALUES
  ('b101','m3','hortifruti','Banana Prata','1 kg',459,20,'Frutas'),
  ('b102','m5','hortifruti','Banana Prata','1 kg',479,20,'Frutas'),
  ('b103','m1','hortifruti','Tomate','1 kg',589,20,'Legumes'),
  ('b104','m3','hortifruti','Tomate','1 kg',519,20,'Legumes'),
  ('b105','m4','hortifruti','Tomate','1 kg',799,20,'Legumes'),
  ('b106','m5','hortifruti','Tomate','1 kg',569,20,'Legumes'),
  ('b107','m2','mercearia','Arroz Tipo 1','5 kg',2690,20,'Grãos'),
  ('b108','m4','mercearia','Arroz Tipo 1','5 kg',2290,20,'Grãos'),
  ('b109','m5','mercearia','Arroz Tipo 1','5 kg',2620,20,'Grãos'),
  ('b110','m1','mercearia','Feijão Carioca','1 kg',949,20,'Grãos'),
  ('b111','m3','mercearia','Feijão Carioca','1 kg',899,20,'Grãos'),
  ('b112','m4','mercearia','Feijão Carioca','1 kg',790,20,'Grãos'),
  ('b113','m5','mercearia','Feijão Carioca','1 kg',980,20,'Grãos'),
  ('b114','m1','mercearia','Óleo de Soja','900 ml',690,20,NULL),
  ('b115','m3','mercearia','Óleo de Soja','900 ml',670,20,NULL),
  ('b116','m5','mercearia','Óleo de Soja','900 ml',680,20,NULL),
  ('b117','m3','laticinios','Leite Integral','1 L',489,20,NULL),
  ('b118','m4','laticinios','Leite Integral','1 L',399,20,NULL),
  ('b119','m5','laticinios','Leite Integral','1 L',499,20,NULL),
  ('b120','m2','hortifruti','Batata Inglesa','1 kg',550,20,'Legumes'),
  ('b121','m4','hortifruti','Batata Inglesa','1 kg',690,20,'Legumes'),
  ('b122','m5','hortifruti','Batata Inglesa','1 kg',530,20,'Legumes'),
  ('b123','m2','hortifruti','Alface Crespa','1 un',290,20,'Verduras'),
  ('b124','m3','hortifruti','Alface Crespa','1 un',270,20,'Verduras'),
  ('b125','m4','hortifruti','Alface Crespa','1 un',390,20,'Verduras'),
  ('b126','m1','mercearia','Café Torrado','500 g',1890,20,NULL),
  ('b127','m3','mercearia','Café Torrado','500 g',1750,20,NULL),
  ('b128','m4','mercearia','Café Torrado','500 g',1490,20,NULL),
  ('b129','m2','hortifruti','Ovos Brancos','dúzia',890,20,'Ovos'),
  ('b130','m4','hortifruti','Ovos Brancos','dúzia',899,20,'Ovos'),
  ('b131','m2','hortifruti','Cebola','1 kg',480,20,'Legumes'),
  ('b132','m3','hortifruti','Cebola','1 kg',459,20,'Legumes'),
  ('b133','m4','hortifruti','Cebola','1 kg',399,20,'Legumes'),
  ('b134','m3','hortifruti','Maçã Gala','1 kg',720,20,'Frutas'),
  ('b135','m4','hortifruti','Maçã Gala','1 kg',699,20,'Frutas');
UPDATE products SET compare_key = lower(trim(name)) || '|' || lower(replace(unit, ' ', '')) WHERE compare_key IS NULL;
-- Chaves de comparação normalizadas (sem acento, minúsculas, unidade sem espaço).

UPDATE products SET compare_key = 'alcatra bovina|1kg' WHERE name = 'Alcatra Bovina' AND unit = '1 kg';
UPDATE products SET compare_key = 'alface crespa|1un' WHERE name = 'Alface Crespa' AND unit = '1 un';
UPDATE products SET compare_key = 'alho|100g' WHERE name = 'Alho' AND unit = '100 g';
UPDATE products SET compare_key = 'arroz integral|1kg' WHERE name = 'Arroz Integral' AND unit = '1 kg';
UPDATE products SET compare_key = 'arroz tipo 1|5kg' WHERE name = 'Arroz Tipo 1' AND unit = '5 kg';
UPDATE products SET compare_key = 'banana prata|1kg' WHERE name = 'Banana Prata' AND unit = '1 kg';
UPDATE products SET compare_key = 'batata inglesa|1kg' WHERE name = 'Batata Inglesa' AND unit = '1 kg';
UPDATE products SET compare_key = 'cafe torrado|500g' WHERE name = 'Café Torrado' AND unit = '500 g';
UPDATE products SET compare_key = 'cebola|1kg' WHERE name = 'Cebola' AND unit = '1 kg';
UPDATE products SET compare_key = 'cenoura|1kg' WHERE name = 'Cenoura' AND unit = '1 kg';
UPDATE products SET compare_key = 'cheiro-verde|1maco' WHERE name = 'Cheiro-Verde' AND unit = '1 maço';
UPDATE products SET compare_key = 'detergente neutro|500ml' WHERE name = 'Detergente Neutro' AND unit = '500 ml';
UPDATE products SET compare_key = 'feijao carioca|1kg' WHERE name = 'Feijão Carioca' AND unit = '1 kg';
UPDATE products SET compare_key = 'laranja pera|1kg' WHERE name = 'Laranja Pera' AND unit = '1 kg';
UPDATE products SET compare_key = 'leite integral|1l' WHERE name = 'Leite Integral' AND unit = '1 L';
UPDATE products SET compare_key = 'maca gala|1kg' WHERE name = 'Maçã Gala' AND unit = '1 kg';
UPDATE products SET compare_key = 'marca da casa|5kg' WHERE name = 'Marca da Casa' AND unit = '5 kg';
UPDATE products SET compare_key = 'oleo de soja|900ml' WHERE name = 'Óleo de Soja' AND unit = '900 ml';
UPDATE products SET compare_key = 'ovos brancos|duzia' WHERE name = 'Ovos Brancos' AND unit = 'dúzia';
UPDATE products SET compare_key = 'pao de queijo|1kg' WHERE name = 'Pão de Queijo' AND unit = '1 kg';
UPDATE products SET compare_key = 'pao frances|1kg' WHERE name = 'Pão Francês' AND unit = '1 kg';
UPDATE products SET compare_key = 'sabonete|85g' WHERE name = 'Sabonete' AND unit = '85 g';
UPDATE products SET compare_key = 'suco de laranja|1l' WHERE name = 'Suco de Laranja' AND unit = '1 L';
UPDATE products SET compare_key = 'tomate|1kg' WHERE name = 'Tomate' AND unit = '1 kg';

-- Lista inteligente: mesmos produtos de marcas diferentes.
INSERT OR IGNORE INTO products (id, market_id, category_id, name, brand, unit, price_cents, stock, subcategory, compare_key) VALUES
  ('c201','m1','mercearia','Açúcar Refinado','União','1 kg',549,25,'Grãos','acucar refinado|1kg'),
  ('c202','m2','mercearia','Açúcar Refinado','União','1 kg',529,25,'Grãos','acucar refinado|1kg'),
  ('c203','m4','mercearia','Açúcar Refinado','União','1 kg',519,25,'Grãos','acucar refinado|1kg'),
  ('c204','m2','mercearia','Açúcar Refinado','Caravelas','1 kg',469,25,'Grãos','acucar refinado|1kg'),
  ('c205','m3','mercearia','Açúcar Refinado','Caravelas','1 kg',459,25,'Grãos','acucar refinado|1kg'),
  ('c206','m4','mercearia','Açúcar Refinado','Caravelas','1 kg',489,25,'Grãos','acucar refinado|1kg'),
  ('c207','m3','mercearia','Açúcar Refinado','Marca da Casa','1 kg',399,25,'Grãos','acucar refinado|1kg'),
  ('c208','m1','mercearia','Açúcar Refinado','União','5 kg',2390,25,'Grãos','acucar refinado|5kg'),
  ('c209','m4','mercearia','Açúcar Refinado','União','5 kg',2290,25,'Grãos','acucar refinado|5kg'),
  ('c210','m1','laticinios','Manteiga','Qualy','200 g',1190,25,NULL,'manteiga|200g'),
  ('c211','m2','laticinios','Manteiga','Qualy','200 g',1150,25,NULL,'manteiga|200g'),
  ('c212','m4','laticinios','Manteiga','Qualy','200 g',1099,25,NULL,'manteiga|200g'),
  ('c213','m3','laticinios','Manteiga','Aviação','200 g',1390,25,NULL,'manteiga|200g'),
  ('c214','m4','laticinios','Manteiga','Aviação','200 g',1350,25,NULL,'manteiga|200g'),
  ('c215','m1','mercearia','Arroz Tipo 1','Tio João','5 kg',3290,25,'Grãos','arroz tipo 1|5kg'),
  ('c216','m2','mercearia','Arroz Tipo 1','Tio João','5 kg',3190,25,'Grãos','arroz tipo 1|5kg'),
  ('c217','m4','mercearia','Arroz Tipo 1','Tio João','5 kg',2990,25,'Grãos','arroz tipo 1|5kg'),
  ('c218','m2','mercearia','Arroz Tipo 1','Camil','5 kg',2890,25,'Grãos','arroz tipo 1|5kg'),
  ('c219','m3','mercearia','Arroz Tipo 1','Camil','5 kg',2950,25,'Grãos','arroz tipo 1|5kg'),
  ('c220','m4','mercearia','Arroz Tipo 1','Camil','5 kg',2790,25,'Grãos','arroz tipo 1|5kg'),
  ('c221','m1','mercearia','Feijão Carioca','Kicaldo','1 kg',999,25,'Grãos','feijao carioca|1kg'),
  ('c222','m4','mercearia','Feijão Carioca','Kicaldo','1 kg',949,25,'Grãos','feijao carioca|1kg'),
  ('c223','m1','mercearia','Óleo de Soja','Liza','900 ml',749,25,NULL,'oleo de soja|900ml'),
  ('c224','m2','mercearia','Óleo de Soja','Liza','900 ml',729,25,NULL,'oleo de soja|900ml'),
  ('c225','m4','mercearia','Óleo de Soja','Liza','900 ml',719,25,NULL,'oleo de soja|900ml'),
  ('c226','m2','laticinios','Leite Integral','Italac','1 L',529,25,NULL,'leite integral|1l'),
  ('c227','m4','laticinios','Leite Integral','Italac','1 L',499,25,NULL,'leite integral|1l'),
  ('c228','m1','mercearia','Café Torrado','Pilão','500 g',1990,25,NULL,'cafe torrado|500g'),
  ('c229','m4','mercearia','Café Torrado','Pilão','500 g',1890,25,NULL,'cafe torrado|500g');

-- Painel do mercado (Fase 8): login de demonstração do SuperMais, estoque mínimo e validades.
UPDATE users SET password_hash = 'pbkdf2$100000$JtHFJuXvV7yx7qzlK1f4pg$Awdv6X6Z1b-Avm1jUz-WXs4igWV_TMoAhbZoUybTToM',
                 email_verified_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = 'u-m1';
UPDATE products SET min_stock = 15 WHERE market_id = 'm1';
UPDATE products SET expires_on = date('now', '+2 day') WHERE id IN ('p1','p22');
UPDATE products SET expires_on = date('now', '+20 day') WHERE id IN ('p19','p23','p24');

-- Administrador de demonstração (somente local): admin@demo.local / demo1234.
INSERT OR IGNORE INTO users (id, name, email, password_hash, role, status, email_verified_at) VALUES
  ('u-admin','Admin EconoRota','admin@demo.local','pbkdf2$100000$JtHFJuXvV7yx7qzlK1f4pg$Awdv6X6Z1b-Avm1jUz-WXs4igWV_TMoAhbZoUybTToM','admin','ativo',strftime('%Y-%m-%dT%H:%M:%fZ','now'));

-- Fase 13: região atendida e mercado aguardando aprovação (demonstração).
INSERT OR IGNORE INTO regions (id, name, city, state, lat, lng, radius_km) VALUES
  ('r-sp-centro','Centro expandido','São Paulo','SP',-23.5570,-46.6560,8);
INSERT OR IGNORE INTO users (id, name, email, password_hash, role, status, email_verified_at) VALUES
  ('u-m9','Bairro Bom','m9@demo.local','pbkdf2$100000$JtHFJuXvV7yx7qzlK1f4pg$Awdv6X6Z1b-Avm1jUz-WXs4igWV_TMoAhbZoUybTToM','mercado','ativo',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
INSERT OR IGNORE INTO markets (id, owner_user_id, name, address, district, city, state, lat, lng, status) VALUES
  ('m9','u-m9','Mercadinho Bairro Bom','Rua Augusta, 900','Consolação','São Paulo','SP',-23.5530,-46.6570,'pendente');
