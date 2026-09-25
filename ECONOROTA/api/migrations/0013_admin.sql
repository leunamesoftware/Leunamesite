-- Fase 13: painel administrativo.
-- Configurações editáveis pela administração (sem novo deploy). Sem linha = valor do wrangler.toml / padrão.
CREATE TABLE settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_by  TEXT REFERENCES users(id),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Permissões da equipe administrativa: JSON com as áreas ("operacao", "financeiro", "sistema"). NULL = acesso total.
ALTER TABLE users ADD COLUMN admin_perms TEXT;

-- Regiões atendidas (cidade/bairros por raio). Usadas para abrir novas áreas e acompanhar cobertura.
CREATE TABLE regions (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  city        TEXT NOT NULL,
  state       TEXT NOT NULL,
  lat         REAL NOT NULL,
  lng         REAL NOT NULL,
  radius_km   REAL NOT NULL DEFAULT 8 CHECK (radius_km > 0 AND radius_km <= 100),
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_orders_status ON orders(status, created_at);
CREATE INDEX idx_orders_created ON orders(created_at);
CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at);
