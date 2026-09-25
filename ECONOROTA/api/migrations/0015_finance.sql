-- Fase 15: financeiro. Livro-razão (quem tem a receber o quê, por pedido) e repasses.
-- amount_cents: positivo = crédito da parte (a receber); negativo = débito (ex.: reembolso por problema no produto).
CREATE TABLE payouts (
  id            TEXT PRIMARY KEY,
  party_type    TEXT NOT NULL CHECK (party_type IN ('mercado','entregador')),
  party_id      TEXT NOT NULL,
  amount_cents  INTEGER NOT NULL CHECK (amount_cents > 0),
  status        TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','cancelado')),
  pix_key       TEXT,
  reference     TEXT,
  created_by    TEXT REFERENCES users(id),
  paid_by       TEXT REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  paid_at       TEXT
);
CREATE INDEX idx_payouts_party ON payouts(party_type, party_id, created_at);
CREATE INDEX idx_payouts_status ON payouts(status, created_at);

CREATE TABLE ledger_entries (
  id            TEXT PRIMARY KEY,
  order_id      TEXT REFERENCES orders(id),
  party_type    TEXT NOT NULL CHECK (party_type IN ('mercado','entregador','plataforma')),
  party_id      TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('venda','comissao','entrega','taxa_plataforma','reembolso','ajuste')),
  amount_cents  INTEGER NOT NULL,
  note          TEXT,
  payout_id     TEXT REFERENCES payouts(id),
  available_at  TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_ledger_party ON ledger_entries(party_type, party_id, created_at);
CREATE INDEX idx_ledger_open ON ledger_entries(party_type, party_id, payout_id, available_at);
CREATE INDEX idx_ledger_order ON ledger_entries(order_id);
-- Um lançamento de venda/comissão/entrega por pedido e parte (liquidação idempotente).
CREATE UNIQUE INDEX uq_ledger_settle ON ledger_entries(order_id, party_type, party_id, kind) WHERE kind IN ('venda','comissao','entrega','taxa_plataforma');


-- Chave Pix do mercado para receber os repasses.
ALTER TABLE markets ADD COLUMN pix_key TEXT;
