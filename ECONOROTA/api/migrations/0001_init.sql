-- EconoRota — estrutura inicial (Fase 1)
-- Valores monetários em centavos (INTEGER). Datas em ISO-8601 (UTC).

CREATE TABLE users (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  email            TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone            TEXT,
  password_hash    TEXT NOT NULL,
  role             TEXT NOT NULL CHECK (role IN ('cliente','mercado','entregador','admin')),
  status           TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','pendente','bloqueado')),
  token_version    INTEGER NOT NULL DEFAULT 0,
  email_verified_at TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_users_role ON users(role, status);

CREATE TABLE addresses (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label       TEXT,
  street      TEXT NOT NULL,
  number      TEXT,
  complement  TEXT,
  district    TEXT,
  city        TEXT NOT NULL,
  state       TEXT NOT NULL,
  zip         TEXT,
  lat         REAL,
  lng         REAL,
  is_default  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_addresses_user ON addresses(user_id);

CREATE TABLE customers (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  default_address_id  TEXT REFERENCES addresses(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','bloqueado'))
);

CREATE TABLE markets (
  id             TEXT PRIMARY KEY,
  owner_user_id  TEXT NOT NULL REFERENCES users(id),
  name           TEXT NOT NULL,
  document       TEXT,
  phone          TEXT,
  address        TEXT,
  city           TEXT,
  state          TEXT,
  lat            REAL,
  lng            REAL,
  rating         REAL NOT NULL DEFAULT 0,
  rating_count   INTEGER NOT NULL DEFAULT 0,
  is_open        INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','ativo','suspenso')),
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_markets_owner ON markets(owner_user_id);
CREATE INDEX idx_markets_status ON markets(status, city);

CREATE TABLE couriers (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  vehicle_type   TEXT CHECK (vehicle_type IN ('moto','bicicleta','carro')),
  vehicle_plate  TEXT,
  status         TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','bloqueado')),
  is_online      INTEGER NOT NULL DEFAULT 0,
  lat            REAL,
  lng            REAL,
  last_seen_at   TEXT
);
CREATE INDEX idx_couriers_online ON couriers(status, is_online);

CREATE TABLE categories (
  id     TEXT PRIMARY KEY,
  name   TEXT NOT NULL,
  icon   TEXT,
  sort   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE products (
  id                 TEXT PRIMARY KEY,
  market_id          TEXT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  category_id        TEXT NOT NULL REFERENCES categories(id),
  name               TEXT NOT NULL,
  brand              TEXT,
  unit               TEXT NOT NULL DEFAULT 'un',
  barcode            TEXT,
  price_cents        INTEGER NOT NULL CHECK (price_cents >= 0),
  promo_price_cents  INTEGER CHECK (promo_price_cents IS NULL OR promo_price_cents >= 0),
  stock              INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  min_stock          INTEGER NOT NULL DEFAULT 0,
  is_active          INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_products_market ON products(market_id, is_active);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_name ON products(name COLLATE NOCASE);
CREATE INDEX idx_products_barcode ON products(barcode);

-- Um pedido pode envolver até 3 mercados (regra validada na API, Fase 5).
CREATE TABLE orders (
  id                  TEXT PRIMARY KEY,
  customer_user_id    TEXT NOT NULL REFERENCES users(id),
  address_id          TEXT REFERENCES addresses(id),
  courier_id          TEXT REFERENCES couriers(id),
  status              TEXT NOT NULL DEFAULT 'criado',
  subtotal_cents      INTEGER NOT NULL DEFAULT 0,
  delivery_fee_cents  INTEGER NOT NULL DEFAULT 0,
  savings_cents       INTEGER NOT NULL DEFAULT 0,
  total_cents         INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_orders_customer ON orders(customer_user_id, created_at);
CREATE INDEX idx_orders_courier ON orders(courier_id, status);

CREATE TABLE order_markets (
  id              TEXT PRIMARY KEY,
  order_id        TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  market_id       TEXT NOT NULL REFERENCES markets(id),
  sequence        INTEGER NOT NULL CHECK (sequence BETWEEN 1 AND 3),
  status          TEXT NOT NULL DEFAULT 'aguardando',
  subtotal_cents  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (order_id, market_id),
  UNIQUE (order_id, sequence)
);
CREATE INDEX idx_order_markets_market ON order_markets(market_id, status);

CREATE TABLE order_items (
  id                TEXT PRIMARY KEY,
  order_market_id   TEXT NOT NULL REFERENCES order_markets(id) ON DELETE CASCADE,
  product_id        TEXT NOT NULL REFERENCES products(id),
  product_name      TEXT NOT NULL,
  unit_price_cents  INTEGER NOT NULL,
  quantity          INTEGER NOT NULL CHECK (quantity > 0)
);
CREATE INDEX idx_order_items_om ON order_items(order_market_id);

CREATE TABLE audit_logs (
  id          TEXT PRIMARY KEY,
  user_id     TEXT,
  action      TEXT NOT NULL,
  entity      TEXT,
  entity_id   TEXT,
  data        TEXT,
  ip          TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_audit_entity ON audit_logs(entity, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

INSERT INTO categories (id, name, icon, sort) VALUES
  ('hortifruti','Hortifrúti','eco',1),
  ('laticinios','Laticínios','egg',2),
  ('padaria','Padaria','bakery',3),
  ('carnes','Carnes','meat',4),
  ('bebidas','Bebidas','drink',5),
  ('limpeza','Limpeza','clean',6),
  ('mercearia','Mercearia','grocery',7),
  ('higiene','Higiene','hygiene',8);
