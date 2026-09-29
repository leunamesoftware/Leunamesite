-- Valor da conta (opcional) e valor que a pessoa pagou, em centavos (R$ 12,34 = 1234).
ALTER TABLE itens ADD COLUMN valor_centavos INTEGER CHECK (valor_centavos IS NULL OR valor_centavos >= 0);
ALTER TABLE itens ADD COLUMN valor_pago_centavos INTEGER CHECK (valor_pago_centavos IS NULL OR valor_pago_centavos >= 0);
