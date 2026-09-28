-- Dados iniciais: tipos de peça (fixos), algumas marcas/modelos comuns, e
-- localização inicial (Baixada Fluminense/RJ, região onde o app começa).
-- Tudo isso pode ser ampliado depois pelo painel admin.

INSERT OR IGNORE INTO tipos_peca (id, nome, ordem) VALUES
 ('tela', 'Tela/Display', 1),
 ('placa', 'Placa-mãe', 2),
 ('bateria', 'Bateria', 3),
 ('carcaca', 'Carcaça/Chassi', 4),
 ('camera', 'Câmera', 5),
 ('alto-falante', 'Alto-falante/Fone', 6),
 ('conector-carga', 'Conector de Carga', 7),
 ('vidro-traseiro', 'Vidro Traseiro', 8),
 ('flex', 'Flex (cabo flexível)', 9),
 ('outro', 'Outra peça', 10);

INSERT OR IGNORE INTO marcas (id, nome, ordem) VALUES
 ('samsung', 'Samsung', 1),
 ('apple', 'Apple (iPhone)', 2),
 ('motorola', 'Motorola', 3),
 ('xiaomi', 'Xiaomi', 4),
 ('lg', 'LG', 5),
 ('multilaser', 'Multilaser', 6),
 ('positivo', 'Positivo', 7),
 ('asus', 'Asus', 8),
 ('outra-marca', 'Outra marca', 9);

INSERT OR IGNORE INTO modelos (id, marca_id, nome) VALUES
 ('samsung-a10', 'samsung', 'Galaxy A10'),
 ('samsung-a20', 'samsung', 'Galaxy A20'),
 ('samsung-a30', 'samsung', 'Galaxy A30'),
 ('samsung-a50', 'samsung', 'Galaxy A50'),
 ('samsung-a51', 'samsung', 'Galaxy A51'),
 ('samsung-a10s', 'samsung', 'Galaxy A10s'),
 ('samsung-j5', 'samsung', 'Galaxy J5'),
 ('samsung-j7', 'samsung', 'Galaxy J7'),
 ('samsung-s10', 'samsung', 'Galaxy S10'),
 ('samsung-s20', 'samsung', 'Galaxy S20'),
 ('iphone-xr', 'apple', 'iPhone XR'),
 ('iphone-11', 'apple', 'iPhone 11'),
 ('iphone-12', 'apple', 'iPhone 12'),
 ('iphone-13', 'apple', 'iPhone 13'),
 ('moto-g8', 'motorola', 'Moto G8'),
 ('moto-g9', 'motorola', 'Moto G9'),
 ('moto-g30', 'motorola', 'Moto G30'),
 ('redmi-9', 'xiaomi', 'Redmi 9'),
 ('redmi-note-10', 'xiaomi', 'Redmi Note 10');

INSERT OR IGNORE INTO estados (id, nome, sigla) VALUES ('rj', 'Rio de Janeiro', 'RJ');

INSERT OR IGNORE INTO cidades (id, estado_id, nome) VALUES
 ('rio-de-janeiro', 'rj', 'Rio de Janeiro'),
 ('duque-de-caxias', 'rj', 'Duque de Caxias'),
 ('nova-iguacu', 'rj', 'Nova Iguaçu'),
 ('sao-joao-de-meriti', 'rj', 'São João de Meriti'),
 ('belford-roxo', 'rj', 'Belford Roxo');

INSERT OR IGNORE INTO bairros (id, cidade_id, nome) VALUES
 ('xerem', 'duque-de-caxias', 'Xerém'),
 ('mantiqueira-xerem', 'duque-de-caxias', 'Mantiqueira (Xerém)'),
 ('santa-cruz-da-serra', 'duque-de-caxias', 'Santa Cruz da Serra'),
 ('centro-caxias', 'duque-de-caxias', 'Centro (Duque de Caxias)'),
 ('centro-nova-iguacu', 'nova-iguacu', 'Centro (Nova Iguaçu)'),
 ('jacarepagua', 'rio-de-janeiro', 'Jacarepaguá'),
 ('campo-grande', 'rio-de-janeiro', 'Campo Grande'),
 ('centro-meriti', 'sao-joao-de-meriti', 'Centro (São João de Meriti)');
