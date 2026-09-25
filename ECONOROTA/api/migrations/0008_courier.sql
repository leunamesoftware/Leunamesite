-- Fase 9: entregador. Cadastro, documentos (fotos no R2, privadas), disponibilidade, GPS e fluxo da entrega.
ALTER TABLE couriers ADD COLUMN cpf TEXT;
ALTER TABLE couriers ADD COLUMN birth_date TEXT;
ALTER TABLE couriers ADD COLUMN cnh_number TEXT;
ALTER TABLE couriers ADD COLUMN pix_key TEXT;
ALTER TABLE couriers ADD COLUMN vehicle_model TEXT;
ALTER TABLE couriers ADD COLUMN vehicle_color TEXT;
ALTER TABLE couriers ADD COLUMN vehicle_photo_key TEXT;
ALTER TABLE couriers ADD COLUMN document_photo_key TEXT;
ALTER TABLE couriers ADD COLUMN work_radius_km INTEGER NOT NULL DEFAULT 5;
ALTER TABLE couriers ADD COLUMN submitted_at TEXT;
ALTER TABLE couriers ADD COLUMN review_note TEXT;

-- Entrega: aceito → a_caminho (após retirar em todos os mercados) → chegou → entregue.
ALTER TABLE orders ADD COLUMN courier_status TEXT;
ALTER TABLE orders ADD COLUMN delivery_code TEXT;
ALTER TABLE orders ADD COLUMN delivery_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN courier_earning_cents INTEGER;
ALTER TABLE orders ADD COLUMN courier_accepted_at TEXT;
ALTER TABLE orders ADD COLUMN courier_arrived_at TEXT;
ALTER TABLE orders ADD COLUMN delivered_at TEXT;
ALTER TABLE order_markets ADD COLUMN courier_arrived_at TEXT;
ALTER TABLE order_markets ADD COLUMN picked_at TEXT;
CREATE INDEX idx_orders_available ON orders(status, courier_id);
