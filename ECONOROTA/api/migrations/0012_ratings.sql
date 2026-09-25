-- Fase 12: avaliações entre cliente, mercado e entregador (depois da entrega).
-- Cliente → mercado continua público em market_reviews; as demais ficam aqui (uso interno e médias).
CREATE TABLE ratings (
  id            TEXT PRIMARY KEY,
  order_id      TEXT NOT NULL REFERENCES orders(id),
  from_user_id  TEXT NOT NULL REFERENCES users(id),
  from_role     TEXT NOT NULL CHECK (from_role IN ('cliente','mercado','entregador')),
  to_type       TEXT NOT NULL CHECK (to_type IN ('mercado','entregador','cliente')),
  to_id         TEXT NOT NULL,
  stars         INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  tags          TEXT,
  comment       TEXT,
  hidden        INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (order_id, from_user_id, to_type, to_id)
);
CREATE INDEX idx_ratings_target ON ratings(to_type, to_id, created_at);
CREATE INDEX idx_ratings_from ON ratings(from_user_id, created_at);

ALTER TABLE couriers ADD COLUMN rating REAL NOT NULL DEFAULT 0;
ALTER TABLE couriers ADD COLUMN rating_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN rating REAL NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN rating_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE market_reviews ADD COLUMN tags TEXT;
ALTER TABLE market_reviews ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;
