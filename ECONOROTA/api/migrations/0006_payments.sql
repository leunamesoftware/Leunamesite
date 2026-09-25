-- Fase 7: pagamentos (Asaas). Dados de cartão NUNCA passam pelo EconoRota: o cliente paga na página segura do Asaas.
ALTER TABLE users ADD COLUMN cpf TEXT;
ALTER TABLE users ADD COLUMN asaas_customer_id TEXT;
ALTER TABLE orders ADD COLUMN cancel_reason TEXT;

CREATE TABLE payments (
  id              TEXT PRIMARY KEY,
  order_id        TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,
  provider_id     TEXT,
  method          TEXT NOT NULL CHECK (method IN ('pix','cartao')),
  status          TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','recusado','cancelado','estornado')),
  amount_cents    INTEGER NOT NULL,
  pix_payload     TEXT,
  pix_image       TEXT,
  pix_expires_at  TEXT,
  invoice_url     TEXT,
  failure_reason  TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_payments_order ON payments(order_id, created_at);
CREATE UNIQUE INDEX idx_payments_provider ON payments(provider, provider_id);

-- Webhooks já processados (o Asaas pode reenviar o mesmo evento).
CREATE TABLE webhook_events (
  id           TEXT PRIMARY KEY,
  received_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
