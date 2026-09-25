-- Fase 4 — loja do mercado: descrição do produto, comparação e avaliações.

ALTER TABLE products ADD COLUMN description TEXT;
-- Subcategoria livre dentro da categoria (ex.: Hortifrúti → Frutas, Verduras, Legumes).
ALTER TABLE products ADD COLUMN subcategory TEXT;
CREATE INDEX idx_products_sub ON products(category_id, subcategory);
-- Chave para comparar o "mesmo produto" entre mercados (nome + unidade normalizados).
ALTER TABLE products ADD COLUMN compare_key TEXT;
UPDATE products SET compare_key = lower(trim(name)) || '|' || lower(replace(unit, ' ', ''));
CREATE INDEX idx_products_compare ON products(compare_key, is_active);

CREATE TABLE market_reviews (
  id          TEXT PRIMARY KEY,
  market_id   TEXT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id    TEXT REFERENCES orders(id),
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (order_id, market_id)
);
CREATE INDEX idx_reviews_market ON market_reviews(market_id, created_at);
