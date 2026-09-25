-- Fase 11: ocorrências (problemas com o pedido), evidências e análise administrativa.
CREATE TABLE occurrences (
  id               TEXT PRIMARY KEY,
  order_id         TEXT NOT NULL REFERENCES orders(id),
  customer_user_id TEXT NOT NULL REFERENCES users(id),
  market_id        TEXT REFERENCES markets(id),
  type             TEXT NOT NULL CHECK (type IN ('produto_errado','produto_faltando','produto_indisponivel',
                     'substituicao_nao_autorizada','entrega_atrasada','pedido_nao_entregue','reclamacao')),
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','em_analise','resolvida','recusada')),
  resolution       TEXT CHECK (resolution IN ('reembolso_total','reembolso_parcial','sem_reembolso')),
  requested_cents  INTEGER NOT NULL DEFAULT 0,
  refund_cents     INTEGER NOT NULL DEFAULT 0,
  admin_note       TEXT,
  auto             INTEGER NOT NULL DEFAULT 0,
  resolved_by      TEXT,
  resolved_at      TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_occ_customer ON occurrences(customer_user_id, created_at);
CREATE INDEX idx_occ_status ON occurrences(status, created_at);
CREATE INDEX idx_occ_order ON occurrences(order_id);
CREATE INDEX idx_occ_market ON occurrences(market_id, created_at);

CREATE TABLE occurrence_items (
  occurrence_id  TEXT NOT NULL REFERENCES occurrences(id) ON DELETE CASCADE,
  order_item_id  TEXT NOT NULL REFERENCES order_items(id),
  quantity       INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (occurrence_id, order_item_id)
);

CREATE TABLE occurrence_evidence (
  id             TEXT PRIMARY KEY,
  occurrence_id  TEXT NOT NULL REFERENCES occurrences(id) ON DELETE CASCADE,
  file_key       TEXT NOT NULL,
  content_type   TEXT NOT NULL,
  uploaded_by    TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Histórico da ocorrência (abertura, mensagens, análise, decisão).
CREATE TABLE occurrence_events (
  id             TEXT PRIMARY KEY,
  occurrence_id  TEXT NOT NULL REFERENCES occurrences(id) ON DELETE CASCADE,
  author_role    TEXT NOT NULL,
  author_id      TEXT,
  kind           TEXT NOT NULL,
  message        TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_occ_events ON occurrence_events(occurrence_id, created_at);

ALTER TABLE payments ADD COLUMN refunded_cents INTEGER NOT NULL DEFAULT 0;
