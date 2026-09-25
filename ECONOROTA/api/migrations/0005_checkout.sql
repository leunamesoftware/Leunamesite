-- Fase 6: confirmação do pedido. Endereço gravado como cópia (o cliente pode editar/apagar o cadastro depois).
ALTER TABLE orders ADD COLUMN payment_method TEXT CHECK (payment_method IN ('pix','cartao'));
ALTER TABLE orders ADD COLUMN delivery_address TEXT;
ALTER TABLE orders ADD COLUMN delivery_lat REAL;
ALTER TABLE orders ADD COLUMN delivery_lng REAL;
