-- Banco do LeuCloud (Cloudflare D1) — LeuName Softwares
-- Primeiro produto do repositório com contas de usuário reais (senha com
-- hash), diferente do esquema de chave de licença dos outros apps.
-- Serve o backend de servidor-leucloud-cloudflare.

-- ===================== PLANOS =====================

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,                 -- slug: 'gratis' | '100gb' | '200gb' | '500gb' | '1tb' | '2tb'
  name TEXT NOT NULL,                  -- nome de exibição
  storage_bytes INTEGER NOT NULL,      -- cota de armazenamento do plano
  price_cents_month INTEGER,           -- preço mensal em centavos de BRL; NULL = plano gratuito
  price_cents_year INTEGER,            -- preço anual em centavos; NULL = sem opção anual
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- ===================== USUÁRIOS =====================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                 -- uuid
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,         -- PBKDF2 derivado, base64
  password_salt TEXT NOT NULL,         -- salt aleatório por usuário, base64
  password_algo TEXT NOT NULL DEFAULT 'PBKDF2-SHA256-v1', -- versionado p/ poder trocar parâmetros no futuro sem quebrar hashes antigos
  password_iterations INTEGER NOT NULL DEFAULT 300000,
  plan_id TEXT NOT NULL DEFAULT 'gratis' REFERENCES plans(id),
  storage_used_bytes INTEGER NOT NULL DEFAULT 0,     -- contador denormalizado, atualizado a cada upload/exclusão/esvaziar lixeira
  storage_quota_override_bytes INTEGER,              -- NULL = usa a cota do plano; permite ajuste manual sem trocar de plano
  is_admin_unlimited INTEGER NOT NULL DEFAULT 0,     -- 1 = armazenamento ilimitado, ignora plano/pagamento (conta do Emanuel)
  status TEXT NOT NULL DEFAULT 'ativo',              -- ativo | suspenso | excluido
  email_verified_at TEXT,
  two_factor_enabled INTEGER NOT NULL DEFAULT 0,
  two_factor_secret TEXT,                            -- segredo TOTP (base32); só existe se 2FA ativado
  avatar_r2_key TEXT,
  locale TEXT NOT NULL DEFAULT 'pt-BR',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan_id);

-- Tokens de uso único: recuperação de senha e verificação de e-mail.
-- Nunca guarda o token cru — só o hash, igual ao padrão de sessão abaixo.
CREATE TABLE IF NOT EXISTS auth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  purpose TEXT NOT NULL,               -- 'password_reset' | 'email_verify'
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  requested_ip TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id, purpose);

-- Limite de tentativas de login/cadastro por e-mail ou IP (proteção
-- basica obrigatoria desde a Fase 1, nao e opcional).
CREATE TABLE IF NOT EXISTS auth_attempts (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,            -- e-mail ou IP
  kind TEXT NOT NULL,                  -- 'login' | 'signup' | 'password_reset'
  succeeded INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_identifier ON auth_attempts(identifier, kind, created_at);

-- ===================== SESSÕES E DISPOSITIVOS =====================

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT,                           -- ex: "iPhone de Emanuel", editável pelo usuário
  platform TEXT NOT NULL,              -- 'web' | 'android' | 'desktop'
  is_trusted_for_biometrics INTEGER NOT NULL DEFAULT 0, -- só controla a trava LOCAL do app, não é fator de servidor
  push_token TEXT,                     -- reservado p/ notificações push futuras
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);

-- Token de sessão: opaco e aleatório, guardado só como hash (mesmo padrão
-- de auth_tokens). Revogação é real e imediata: apagar/marcar a linha,
-- diferente de um JWT que continua válido até expirar sozinho.
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  device_id TEXT REFERENCES devices(id),
  session_token_hash TEXT NOT NULL UNIQUE,
  ip_created TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, revoked_at);

-- ===================== ARQUIVOS E PASTAS =====================

CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  parent_id TEXT REFERENCES folders(id),   -- NULL = raiz
  name TEXT NOT NULL,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  is_deleted INTEGER NOT NULL DEFAULT 0,   -- lixeira (soft-delete)
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_folders_user_parent ON folders(user_id, parent_id, is_deleted);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  folder_id TEXT REFERENCES folders(id),   -- NULL = raiz
  name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER NOT NULL,
  r2_key TEXT NOT NULL,                    -- chave do objeto ATUAL no R2 (ex: users/<user_id>/<file_id>/v3)
  current_version INTEGER NOT NULL DEFAULT 1,
  checksum_sha256 TEXT,
  category TEXT NOT NULL DEFAULT 'outro',  -- 'foto' | 'video' | 'documento' | 'outro' — calculado no upload, usado na tela Fotos
  source TEXT NOT NULL DEFAULT 'upload',   -- 'upload' | 'auto_backup'
  is_favorite INTEGER NOT NULL DEFAULT 0,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_files_user_folder ON files(user_id, folder_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_files_user_category ON files(user_id, category, is_deleted);
CREATE INDEX IF NOT EXISTS idx_files_user_favorite ON files(user_id, is_favorite);

-- Histórico de versões (Fase 3). Cada versão anterior mantém seu próprio
-- objeto no R2 até ser podada por política de retenção (cron).
CREATE TABLE IF NOT EXISTS file_versions (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES files(id),
  version_number INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(file_id, version_number)
);

-- Álbuns (Fase 2) — agrupam fotos/vídeos por escolha do usuário,
-- independente da pasta onde o arquivo está.
CREATE TABLE IF NOT EXISTS albums (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  cover_file_id TEXT REFERENCES files(id),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS album_items (
  album_id TEXT NOT NULL REFERENCES albums(id),
  file_id TEXT NOT NULL REFERENCES files(id),
  added_at TEXT NOT NULL,
  PRIMARY KEY (album_id, file_id)
);

-- ===================== COMPARTILHAMENTO =====================

-- Links públicos (com ou sem senha, com ou sem expiração).
CREATE TABLE IF NOT EXISTS shares (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  file_id TEXT REFERENCES files(id),
  folder_id TEXT REFERENCES folders(id),   -- exatamente um dos dois preenchido
  token TEXT NOT NULL UNIQUE,              -- parte pública da URL (/s/<token>)
  password_hash TEXT,                      -- PBKDF2, só se o link tiver senha
  permission TEXT NOT NULL DEFAULT 'visualizar', -- 'visualizar' | 'editar' (editar fica para versão futura)
  expires_at TEXT,
  max_downloads INTEGER,
  download_count INTEGER NOT NULL DEFAULT 0,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shares_owner ON shares(owner_id, revoked_at);

-- Compartilhamento direto usuário-para-usuário (telas "Compartilhado
-- comigo" / "Compartilhado por mim"), separado de links públicos.
CREATE TABLE IF NOT EXISTS share_recipients (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  file_id TEXT REFERENCES files(id),
  folder_id TEXT REFERENCES folders(id),
  shared_with_user_id TEXT NOT NULL REFERENCES users(id),
  permission TEXT NOT NULL DEFAULT 'visualizar',
  created_at TEXT NOT NULL,
  UNIQUE(file_id, folder_id, shared_with_user_id)
);
CREATE INDEX IF NOT EXISTS idx_share_recipients_recipient ON share_recipients(shared_with_user_id);

-- ===================== COBRANÇA (ESQUELETO — Fase 4) =====================

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  plan_id TEXT NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL DEFAULT 'ativa',    -- ativa | cancelada | expirada | pendente
  billing_cycle TEXT,                       -- 'mensal' | 'anual' | NULL (gratuito/admin)
  gateway TEXT,                             -- 'stripe' | 'mercadopago' | NULL — indefinido até a Fase 4
  gateway_subscription_id TEXT,
  started_at TEXT NOT NULL,
  current_period_end TEXT,
  canceled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);

-- TABELA-ESQUELETO: existe desde a Fase 1 para não exigir migração de
-- schema depois, mas fica VAZIA/sem uso real até a Fase 4 escolher e
-- integrar um gateway de pagamento de verdade. Não montar nenhuma tela
-- que finja "pagamento processado" antes disso.
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  subscription_id TEXT REFERENCES subscriptions(id),
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'pendente',  -- pendente | pago | falhou | reembolsado
  gateway TEXT,
  gateway_payment_id TEXT,
  gateway_raw_payload TEXT,                 -- JSON bruto do webhook, para auditoria/depuração
  paid_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);

-- ===================== SUPORTE, NOTIFICAÇÕES, LOGS, CONFIG =====================

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,       -- 'armazenamento_quase_cheio' | 'novo_compartilhamento' | 'pagamento' | 'seguranca' | 'sistema'
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,                -- deep link dentro do app
  is_read INTEGER NOT NULL DEFAULT 0,
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberto',   -- aberto | respondido | fechado
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS support_messages (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES support_tickets(id),
  sender_type TEXT NOT NULL,   -- 'usuario' | 'admin'
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages(ticket_id);

-- Log de auditoria: login, upload, exclusão, criação de link, mudança de
-- plano, ações de admin — tudo. Base das telas "Logs" (admin) e útil
-- para investigar abuso/suporte.
CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),   -- NULL para ações de sistema (cron, etc.)
  action TEXT NOT NULL,                -- 'login' | 'upload' | 'delete' | 'share_create' | 'plan_change' | ...
  target_type TEXT,
  target_id TEXT,
  ip TEXT,
  metadata TEXT,                       -- JSON livre
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action, created_at);

-- Configuração editável do sistema (chave-valor), usada pela tela
-- "Configurações" do painel admin.
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,     -- JSON
  updated_at TEXT NOT NULL
);

-- ===================== DADOS INICIAIS =====================

INSERT OR IGNORE INTO plans (id, name, storage_bytes, price_cents_month, price_cents_year, is_active, sort_order, created_at) VALUES
  ('gratis', 'Gratuito', 5368709120,      NULL,  NULL,   1, 0, datetime('now')),   -- 5 GB
  ('100gb',  '100 GB',   107374182400,    1990,  19900,  1, 1, datetime('now')),
  ('200gb',  '200 GB',   214748364800,    2990,  29900,  1, 2, datetime('now')),
  ('500gb',  '500 GB',   536870912000,    4990,  49900,  1, 3, datetime('now')),
  ('1tb',    '1 TB',     1099511627776,   7990,  79900,  1, 4, datetime('now')),
  ('2tb',    '2 TB+',    2199023255552,   11990, 119900, 1, 5, datetime('now'));
