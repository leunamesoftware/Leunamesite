-- Fase 3 — home do cliente: dados de loja, fotos e categorias com cor.

ALTER TABLE markets ADD COLUMN district TEXT;
ALTER TABLE markets ADD COLUMN image_url TEXT;
ALTER TABLE markets ADD COLUMN delivery_fee_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE markets ADD COLUMN min_order_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE markets ADD COLUMN eta_min INTEGER NOT NULL DEFAULT 30;
ALTER TABLE markets ADD COLUMN eta_max INTEGER NOT NULL DEFAULT 45;
-- Horário local (America/Sao_Paulo), formato HH:MM.
ALTER TABLE markets ADD COLUMN opens_at TEXT NOT NULL DEFAULT '07:00';
ALTER TABLE markets ADD COLUMN closes_at TEXT NOT NULL DEFAULT '22:00';
CREATE INDEX idx_markets_geo ON markets(status, lat, lng);

ALTER TABLE products ADD COLUMN image_url TEXT;
CREATE INDEX idx_products_promo ON products(is_active, promo_price_cents);

ALTER TABLE order_items ADD COLUMN image_url TEXT;

ALTER TABLE categories ADD COLUMN color TEXT;
UPDATE categories SET name = 'Açougue' WHERE id = 'carnes';
UPDATE categories SET name = 'Hortifrúti' WHERE id = 'hortifruti';
UPDATE categories SET color = '#1FA84F' WHERE id = 'hortifruti';
UPDATE categories SET color = '#E53935', sort = 2 WHERE id = 'carnes';
UPDATE categories SET color = '#1E6BFF', sort = 3 WHERE id = 'laticinios';
UPDATE categories SET color = '#F59E0B', sort = 4 WHERE id = 'padaria';
UPDATE categories SET color = '#7B2CBF', sort = 5 WHERE id = 'mercearia';
UPDATE categories SET color = '#EAB308', sort = 6 WHERE id = 'bebidas';
UPDATE categories SET color = '#EC4899', sort = 7 WHERE id = 'higiene';
UPDATE categories SET color = '#06B6D4', sort = 8 WHERE id = 'limpeza';
INSERT INTO categories (id, name, icon, sort, color) VALUES
  ('congelados','Congelados','frozen',9,'#3B82F6'),
  ('saudaveis','Saudáveis','leaf',10,'#16A34A'),
  ('bebe','Bebê','baby',11,'#FB923C'),
  ('pet','Pet','pet',12,'#8B5CF6'),
  ('casa','Casa','home',13,'#EF4444');
