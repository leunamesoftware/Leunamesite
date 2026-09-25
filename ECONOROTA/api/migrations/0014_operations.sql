-- Fase 14: inteligência operacional.
-- Peso estimado do pedido (gramas), usado para escolher o veículo (bicicleta, moto, carro).
ALTER TABLE orders ADD COLUMN weight_grams INTEGER;
