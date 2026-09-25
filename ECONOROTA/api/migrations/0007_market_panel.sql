-- Fase 8: painel do supermercado.
-- Movimentos de estoque (entrada, saída, ajuste, venda, estorno) para histórico e auditoria.
CREATE TABLE stock_movements (
  id          TEXT PRIMARY KEY,
  market_id   TEXT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('entrada','saida','ajuste','venda','estorno')),
  quantity    INTEGER NOT NULL,
  stock_after INTEGER,
  reason      TEXT,
  user_id     TEXT,
  order_id    TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_stock_mov_market ON stock_movements(market_id, created_at);
CREATE INDEX idx_stock_mov_product ON stock_movements(product_id, created_at);

-- Validade (perecíveis) e fluxo do pedido no mercado: novo → em_separacao → conferido → pronto.
ALTER TABLE products ADD COLUMN expires_on TEXT;
ALTER TABLE order_items ADD COLUMN checked INTEGER; -- NULL: não conferido · 1: ok · 0: em falta
ALTER TABLE order_markets ADD COLUMN accepted_at TEXT;
ALTER TABLE order_markets ADD COLUMN ready_at TEXT;
CREATE INDEX idx_order_markets_status ON order_markets(market_id, status);
