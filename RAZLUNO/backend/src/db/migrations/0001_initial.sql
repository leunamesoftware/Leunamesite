-- Razluno — schema inicial (Fase 1).
-- Convenções:
--   * ids: TEXT (UUID v4).
--   * data-hora: TEXT ISO 8601 em UTC (ex.: 2026-10-01T09:00:00.000Z). O fuso de exibição fica em colunas *timezone (IANA).
--   * dinheiro: INTEGER em centavos + moeda ISO 4217 (EUR, GBP, CHF...). Nunca REAL.
--   * percentuais: INTEGER em pontos-base (1% = 100 bp; 50% = 5000 bp).
--   * JSON: TEXT com JSON válido.

-- ===================== referência =====================

CREATE TABLE languages (
  code        TEXT PRIMARY KEY,            -- ISO 639-1 (pt, en, es, fr, it, de)
  native_name TEXT NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE countries (
  code             TEXT PRIMARY KEY,       -- ISO 3166-1 alfa-2; nome exibido vem do próprio idioma do app
  currency         TEXT NOT NULL,          -- moeda local (informativa; a plataforma cobra na moeda da turma)
  default_language TEXT NOT NULL REFERENCES languages(code),
  is_active        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE categories (
  id         TEXT PRIMARY KEY,             -- slug estável (culinary, music...)
  icon       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE category_translations (
  category_id   TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL REFERENCES languages(code),
  name          TEXT NOT NULL,
  PRIMARY KEY (category_id, language_code)
);

-- Configurações da plataforma (valores que o administrador muda sem mexer no código).
CREATE TABLE platform_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,                -- JSON
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

-- ===================== identidade e acesso =====================

CREATE TABLE users (
  id                TEXT PRIMARY KEY,
  email             TEXT NOT NULL UNIQUE,  -- sempre minúsculo
  password_hash     TEXT,                  -- NULL quando a conta só entra por Google/Apple
  display_name      TEXT NOT NULL,
  avatar_key        TEXT,
  country_code      TEXT NOT NULL REFERENCES countries(code),
  language_code     TEXT NOT NULL REFERENCES languages(code),
  timezone          TEXT NOT NULL DEFAULT 'Europe/Lisbon',
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  email_verified_at TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  deleted_at        TEXT
);

CREATE TABLE user_roles (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('student', 'instructor', 'admin', 'moderator')),
  granted_at TEXT NOT NULL,
  granted_by TEXT,                         -- NULL = cadastro próprio
  PRIMARY KEY (user_id, role)
);

CREATE TABLE sessions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,       -- só o SHA-256; o token em si fica só no aparelho
  user_agent   TEXT,
  created_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  revoked_at   TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE login_attempts (
  id         TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,                -- "login:<email>", "login-ip:<ip>", "signup:<ip>"...
  success    INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_login_attempts ON login_attempts(identifier, created_at);

-- Tokens de uso único (recuperar senha, confirmar e-mail). Só o hash é guardado.
CREATE TABLE auth_tokens (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose    TEXT NOT NULL CHECK (purpose IN ('password_reset', 'email_verification')),
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at    TEXT
);
CREATE INDEX idx_auth_tokens_user ON auth_tokens(user_id, purpose);

-- Login social (Google/Apple). Fica vazio até as credenciais de cada provedor serem configuradas.
CREATE TABLE auth_identities (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider   TEXT NOT NULL CHECK (provider IN ('google', 'apple')),
  subject    TEXT NOT NULL,                -- id do usuário no provedor
  email      TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (provider, subject)
);

CREATE TABLE student_profiles (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bio        TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE instructor_profiles (
  user_id             TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  headline            TEXT,
  bio                 TEXT,
  specialties         TEXT NOT NULL DEFAULT '[]',   -- JSON: lista de textos
  teaching_languages  TEXT NOT NULL DEFAULT '[]',   -- JSON: códigos de idioma
  -- Verificação: o professor só publica turmas depois de 'approved'.
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'under_review', 'approved', 'rejected', 'suspended')),
  legal_entity_type   TEXT CHECK (legal_entity_type IN ('individual', 'company')),
  legal_name          TEXT,
  tax_id              TEXT,                -- NIF / VAT / equivalente do país
  tax_country         TEXT REFERENCES countries(code),
  business_address    TEXT,
  verified_at         TEXT,
  verified_by         TEXT REFERENCES users(id),
  rejection_reason    TEXT,
  payout_account_ref  TEXT,                -- id da conta do professor no provedor de pagamentos (nunca dados bancários aqui)
  payouts_enabled     INTEGER NOT NULL DEFAULT 0,
  rating_avg          REAL,
  rating_count        INTEGER NOT NULL DEFAULT 0,
  students_count      INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE INDEX idx_instructor_status ON instructor_profiles(verification_status);

-- Consentimentos (GDPR): termos, privacidade, gravação das aulas, cursos com risco...
CREATE TABLE consents (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('terms', 'privacy', 'marketing', 'recording', 'hazardous_course', 'withdrawal_policy')),
  version    TEXT NOT NULL,
  granted    INTEGER NOT NULL,             -- 1 aceitou, 0 retirou
  context_id TEXT,                         -- ex.: turma a que o consentimento se refere
  ip_hash    TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_consents_user ON consents(user_id, kind);

-- ===================== cursos e turmas =====================

CREATE TABLE courses (
  id                         TEXT PRIMARY KEY,
  instructor_id              TEXT NOT NULL REFERENCES users(id),
  category_id                TEXT NOT NULL REFERENCES categories(id),
  title                      TEXT NOT NULL,
  summary                    TEXT,
  description                TEXT,
  language_code              TEXT NOT NULL REFERENCES languages(code),
  level                      TEXT NOT NULL DEFAULT 'all_levels' CHECK (level IN ('beginner', 'intermediate', 'advanced', 'all_levels')),
  duration_minutes           INTEGER CHECK (duration_minutes > 0),
  cover_key                  TEXT,
  learning_outcomes          TEXT NOT NULL DEFAULT '[]',  -- JSON
  required_materials         TEXT NOT NULL DEFAULT '[]',  -- JSON
  recommended_materials      TEXT NOT NULL DEFAULT '[]',  -- JSON
  -- Cursos com risco físico (elétrica, ferramentas...): exigem aviso e aceite do aluno.
  is_hazardous               INTEGER NOT NULL DEFAULT 0,
  safety_notice              TEXT,
  certificate_enabled        INTEGER NOT NULL DEFAULT 1,
  completion_min_attendance_bp INTEGER NOT NULL DEFAULT 8000 CHECK (completion_min_attendance_bp BETWEEN 0 AND 10000),
  status                     TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'published', 'archived', 'rejected')),
  created_at                 TEXT NOT NULL,
  updated_at                 TEXT NOT NULL,
  published_at               TEXT
);
CREATE INDEX idx_courses_instructor ON courses(instructor_id);
CREATE INDEX idx_courses_catalog ON courses(status, category_id, language_code);

CREATE TABLE course_modules (
  id          TEXT PRIMARY KEY,
  course_id   TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  UNIQUE (course_id, position)
);

CREATE TABLE lessons (
  id               TEXT PRIMARY KEY,
  course_id        TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  module_id        TEXT REFERENCES course_modules(id) ON DELETE SET NULL,
  position         INTEGER NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  duration_minutes INTEGER CHECK (duration_minutes > 0),
  UNIQUE (course_id, position)
);

-- Turma: uma edição do curso, com horário, vagas e preço próprios.
-- O mesmo curso pode ter várias turmas (manhã, tarde, noite, outros dias).
CREATE TABLE class_sessions (
  id                    TEXT PRIMARY KEY,
  course_id             TEXT NOT NULL REFERENCES courses(id),
  instructor_id         TEXT NOT NULL REFERENCES users(id),
  label                 TEXT,              -- ex.: "Manhã"
  timezone              TEXT NOT NULL,     -- fuso do professor (IANA)
  starts_at             TEXT NOT NULL,     -- início do 1º encontro (UTC)
  ends_at               TEXT NOT NULL,     -- fim do último encontro (UTC)
  capacity              INTEGER NOT NULL CHECK (capacity BETWEEN 1 AND 100),  -- limite real vem de platform_settings
  seats_taken           INTEGER NOT NULL DEFAULT 0 CHECK (seats_taken >= 0 AND seats_taken <= capacity),
  price_cents           INTEGER NOT NULL CHECK (price_cents >= 0),
  currency              TEXT NOT NULL DEFAULT 'EUR',
  language_code         TEXT NOT NULL REFERENCES languages(code),
  enrollment_opens_at   TEXT,
  enrollment_deadline   TEXT NOT NULL,     -- nunca depois de starts_at
  status                TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
                          ('draft', 'enrollment_open', 'full', 'enrollment_closed', 'scheduled', 'live', 'completed', 'canceled')),
  opening_fee_payment_id TEXT,             -- taxa de abertura paga pelo professor (ver payments)
  canceled_reason       TEXT,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  started_at            TEXT,
  completed_at          TEXT,
  canceled_at           TEXT,
  CHECK (enrollment_deadline <= starts_at),
  CHECK (starts_at < ends_at)
);
CREATE INDEX idx_class_sessions_course ON class_sessions(course_id, status, starts_at);
CREATE INDEX idx_class_sessions_instructor ON class_sessions(instructor_id, starts_at);

-- Encontros ao vivo de uma turma (ex.: 7 dias seguidos às 09:00).
CREATE TABLE live_sessions (
  id               TEXT PRIMARY KEY,
  class_session_id TEXT NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  lesson_id        TEXT REFERENCES lessons(id) ON DELETE SET NULL,
  sequence         INTEGER NOT NULL,
  scheduled_start  TEXT NOT NULL,
  scheduled_end    TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended', 'canceled')),
  provider         TEXT,                   -- provedor de vídeo (camada de abstração)
  provider_room_id TEXT,
  recording_enabled INTEGER NOT NULL DEFAULT 1,
  started_at       TEXT,
  ended_at         TEXT,
  UNIQUE (class_session_id, sequence),
  CHECK (scheduled_start < scheduled_end)
);
CREATE INDEX idx_live_sessions_time ON live_sessions(status, scheduled_start);

CREATE TABLE enrollments (
  id               TEXT PRIMARY KEY,
  class_session_id TEXT NOT NULL REFERENCES class_sessions(id),
  student_id       TEXT NOT NULL REFERENCES users(id),
  status           TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN
                     ('pending_payment', 'confirmed', 'canceled_by_student', 'canceled_by_instructor',
                      'canceled_by_platform', 'expired', 'completed', 'no_show')),
  price_cents      INTEGER NOT NULL CHECK (price_cents >= 0),  -- preço congelado no momento da inscrição
  currency         TEXT NOT NULL,
  hold_expires_at  TEXT,                   -- vaga segurada enquanto o pagamento não confirma
  payment_id       TEXT,
  attendance_bp    INTEGER CHECK (attendance_bp BETWEEN 0 AND 10000),
  created_at       TEXT NOT NULL,
  confirmed_at     TEXT,
  canceled_at      TEXT,
  completed_at     TEXT,
  UNIQUE (class_session_id, student_id)
);
CREATE INDEX idx_enrollments_student ON enrollments(student_id, status);

CREATE TABLE attendances (
  live_session_id  TEXT NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_joined_at  TEXT NOT NULL,
  last_left_at     TEXT,
  seconds_present  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (live_session_id, user_id)
);

CREATE TABLE waitlist (
  id               TEXT PRIMARY KEY,
  class_session_id TEXT NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at       TEXT NOT NULL,
  notified_at      TEXT,
  UNIQUE (class_session_id, user_id)
);

CREATE TABLE favorites (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id  TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, course_id)
);

-- ===================== pagamentos =====================

-- Regras de cobrança da plataforma. Nada de valor fixo no código.
--   class_opening_fee: o professor paga por turma aberta (ex.: €5).
--   enrollment_commission: parte de cada inscrição (percentual, fixo ou os dois).
CREATE TABLE fee_rules (
  id           TEXT PRIMARY KEY,
  kind         TEXT NOT NULL CHECK (kind IN ('class_opening_fee', 'enrollment_commission')),
  calc         TEXT NOT NULL CHECK (calc IN ('fixed', 'percent', 'hybrid')),
  fixed_cents  INTEGER NOT NULL DEFAULT 0 CHECK (fixed_cents >= 0),
  percent_bp   INTEGER NOT NULL DEFAULT 0 CHECK (percent_bp BETWEEN 0 AND 10000),
  currency     TEXT NOT NULL DEFAULT 'EUR',
  country_code TEXT REFERENCES countries(code),   -- NULL = todos os países
  category_id  TEXT REFERENCES categories(id),    -- NULL = todas as categorias
  valid_from   TEXT NOT NULL,
  valid_to     TEXT,
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL,
  created_by   TEXT
);

CREATE TABLE payments (
  id                   TEXT PRIMARY KEY,
  payer_id             TEXT NOT NULL REFERENCES users(id),
  purpose              TEXT NOT NULL CHECK (purpose IN ('enrollment', 'class_opening_fee')),
  enrollment_id        TEXT REFERENCES enrollments(id),
  class_session_id     TEXT REFERENCES class_sessions(id),
  amount_cents         INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency             TEXT NOT NULL,
  -- Só o provedor confirma pagamento: 'succeeded' vem exclusivamente do webhook verificado.
  status               TEXT NOT NULL DEFAULT 'created' CHECK (status IN
                         ('created', 'pending', 'succeeded', 'failed', 'canceled', 'refunded', 'partially_refunded')),
  provider             TEXT NOT NULL,
  provider_payment_id  TEXT UNIQUE,
  provider_checkout_id TEXT UNIQUE,
  is_test              INTEGER NOT NULL,   -- 1 = sandbox
  failure_reason       TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  succeeded_at         TEXT
);
CREATE INDEX idx_payments_payer ON payments(payer_id, created_at);

-- Livro-razão de cada movimento informado pelo provedor (idempotente por evento).
CREATE TABLE payment_transactions (
  id            TEXT PRIMARY KEY,
  payment_id    TEXT NOT NULL REFERENCES payments(id),
  type          TEXT NOT NULL CHECK (type IN ('charge', 'refund', 'provider_fee', 'platform_fee', 'transfer', 'payout', 'adjustment')),
  amount_cents  INTEGER NOT NULL,
  currency      TEXT NOT NULL,
  provider_ref  TEXT,
  provider_event_id TEXT UNIQUE,
  created_at    TEXT NOT NULL
);

-- Divisão calculada de cada pagamento (bruto, taxa do provedor, comissão, líquido do professor).
CREATE TABLE platform_fees (
  id                   TEXT PRIMARY KEY,
  payment_id           TEXT NOT NULL UNIQUE REFERENCES payments(id),
  fee_rule_id          TEXT REFERENCES fee_rules(id),
  gross_cents          INTEGER NOT NULL,
  provider_fee_cents   INTEGER NOT NULL DEFAULT 0,
  platform_fee_cents   INTEGER NOT NULL,
  instructor_net_cents INTEGER NOT NULL,
  currency             TEXT NOT NULL,
  created_at           TEXT NOT NULL,
  CHECK (gross_cents = provider_fee_cents + platform_fee_cents + instructor_net_cents)
);

CREATE TABLE refunds (
  id                        TEXT PRIMARY KEY,
  payment_id                TEXT NOT NULL REFERENCES payments(id),
  enrollment_id             TEXT REFERENCES enrollments(id),
  reason                    TEXT NOT NULL CHECK (reason IN ('student_withdrawal', 'instructor_cancel', 'platform_cancel', 'dispute', 'other')),
  amount_cents              INTEGER NOT NULL CHECK (amount_cents >= 0),  -- devolvido ao aluno
  retained_cents            INTEGER NOT NULL DEFAULT 0,                  -- retido por desistência
  retained_platform_cents   INTEGER NOT NULL DEFAULT 0,
  retained_instructor_cents INTEGER NOT NULL DEFAULT 0,
  currency                  TEXT NOT NULL,
  status                    TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'pending', 'succeeded', 'failed', 'rejected')),
  provider_refund_id        TEXT UNIQUE,
  requested_by              TEXT REFERENCES users(id),
  created_at                TEXT NOT NULL,
  processed_at              TEXT,
  CHECK (retained_cents = retained_platform_cents + retained_instructor_cents)
);

CREATE TABLE instructor_payouts (
  id                 TEXT PRIMARY KEY,
  instructor_id      TEXT NOT NULL REFERENCES users(id),
  amount_cents       INTEGER NOT NULL CHECK (amount_cents > 0),
  currency           TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'paid', 'failed', 'canceled')),
  provider           TEXT NOT NULL,
  provider_payout_id TEXT UNIQUE,
  period_start       TEXT,
  period_end         TEXT,
  created_at         TEXT NOT NULL,
  paid_at            TEXT
);
CREATE INDEX idx_payouts_instructor ON instructor_payouts(instructor_id, created_at);

-- ===================== conteúdo da turma =====================

CREATE TABLE recordings (
  id                TEXT PRIMARY KEY,
  live_session_id   TEXT NOT NULL REFERENCES live_sessions(id),
  class_session_id  TEXT NOT NULL REFERENCES class_sessions(id),
  provider          TEXT NOT NULL,
  provider_asset_id TEXT,
  storage_key       TEXT,
  duration_seconds  INTEGER,
  status            TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'failed', 'deleted')),
  available_until   TEXT,                  -- política de retenção
  created_at        TEXT NOT NULL,
  deleted_at        TEXT
);
CREATE INDEX idx_recordings_class ON recordings(class_session_id);

CREATE TABLE materials (
  id               TEXT PRIMARY KEY,
  course_id        TEXT REFERENCES courses(id) ON DELETE CASCADE,
  class_session_id TEXT REFERENCES class_sessions(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL CHECK (kind IN ('file', 'link')),
  title            TEXT NOT NULL,
  description      TEXT,
  storage_key      TEXT,
  url              TEXT,
  created_by       TEXT NOT NULL REFERENCES users(id),
  created_at       TEXT NOT NULL,
  CHECK (course_id IS NOT NULL OR class_session_id IS NOT NULL),
  CHECK ((kind = 'file' AND storage_key IS NOT NULL) OR (kind = 'link' AND url IS NOT NULL))
);

CREATE TABLE certificates (
  id               TEXT PRIMARY KEY,
  code             TEXT NOT NULL UNIQUE,   -- código público curto (QR Code / página de verificação)
  enrollment_id    TEXT NOT NULL UNIQUE REFERENCES enrollments(id),
  student_id       TEXT NOT NULL REFERENCES users(id),
  course_id        TEXT NOT NULL REFERENCES courses(id),
  class_session_id TEXT NOT NULL REFERENCES class_sessions(id),
  instructor_id    TEXT NOT NULL REFERENCES users(id),
  -- Cópia dos nomes no momento da emissão (o certificado não muda se o perfil mudar).
  student_name     TEXT NOT NULL,
  course_title     TEXT NOT NULL,
  instructor_name  TEXT NOT NULL,
  issued_at        TEXT NOT NULL,
  signature        TEXT NOT NULL,          -- HMAC dos dados acima
  pdf_key          TEXT,
  revoked_at       TEXT,
  revoke_reason    TEXT
);

CREATE TABLE certificate_verifications (
  id             TEXT PRIMARY KEY,
  certificate_id TEXT NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
  verified_at    TEXT NOT NULL,
  ip_hash        TEXT
);

CREATE TABLE reviews (
  id            TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL UNIQUE REFERENCES enrollments(id),
  course_id     TEXT NOT NULL REFERENCES courses(id),
  instructor_id TEXT NOT NULL REFERENCES users(id),
  student_id    TEXT NOT NULL REFERENCES users(id),
  rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT,
  status        TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'removed')),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX idx_reviews_course ON reviews(course_id, status);

-- ===================== comunicação =====================

CREATE TABLE conversations (
  id               TEXT PRIMARY KEY,
  student_id       TEXT NOT NULL REFERENCES users(id),
  instructor_id    TEXT NOT NULL REFERENCES users(id),
  course_id        TEXT REFERENCES courses(id),
  class_session_id TEXT REFERENCES class_sessions(id),
  created_at       TEXT NOT NULL,
  last_message_at  TEXT
);
CREATE INDEX idx_conversations_student ON conversations(student_id, last_message_at);
CREATE INDEX idx_conversations_instructor ON conversations(instructor_id, last_message_at);

CREATE TABLE messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       TEXT NOT NULL REFERENCES users(id),
  body            TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  read_at         TEXT,
  deleted_at      TEXT
);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);

CREATE TABLE user_blocks (
  blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN (
               'enrollment_confirmed', 'payment_succeeded', 'class_reminder', 'class_starting', 'schedule_changed',
               'class_canceled', 'new_message', 'recording_available', 'certificate_available',
               'instructor_verification', 'refund_processed')),
  data       TEXT NOT NULL DEFAULT '{}',   -- JSON; o texto é montado no idioma do usuário pelo app
  created_at TEXT NOT NULL,
  read_at    TEXT
);
CREATE INDEX idx_notifications_user ON notifications(user_id, read_at, created_at);

-- ===================== moderação, suporte e auditoria =====================

CREATE TABLE reports (
  id          TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('user', 'course', 'class_session', 'message', 'review', 'recording')),
  target_id   TEXT NOT NULL,
  reason      TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate', 'fraud', 'safety', 'copyright', 'other')),
  details     TEXT,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved', 'dismissed')),
  created_at  TEXT NOT NULL,
  resolved_at TEXT,
  resolved_by TEXT REFERENCES users(id)
);
CREATE INDEX idx_reports_status ON reports(status, created_at);

CREATE TABLE moderation_actions (
  id           TEXT PRIMARY KEY,
  report_id    TEXT REFERENCES reports(id),
  moderator_id TEXT NOT NULL REFERENCES users(id),
  target_type  TEXT NOT NULL,
  target_id    TEXT NOT NULL,
  action       TEXT NOT NULL CHECK (action IN (
                 'warn', 'hide', 'remove', 'suspend_user', 'reinstate_user', 'approve_course', 'reject_course',
                 'approve_instructor', 'reject_instructor', 'suspend_instructor')),
  reason       TEXT,
  created_at   TEXT NOT NULL
);

CREATE TABLE audit_logs (
  id          TEXT PRIMARY KEY,
  actor_id    TEXT,                        -- NULL = sistema / visitante
  action      TEXT NOT NULL,               -- ex.: auth.login, auth.login_failed, account.password_changed
  target_type TEXT,
  target_id   TEXT,
  ip_hash     TEXT,                        -- IP nunca é guardado puro
  user_agent  TEXT,
  data        TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id, created_at);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at);

CREATE TABLE support_tickets (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  subject    TEXT NOT NULL,
  topic      TEXT NOT NULL CHECK (topic IN ('account', 'payment', 'class', 'instructor', 'certificate', 'technical', 'other')),
  status     TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'resolved', 'closed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE support_messages (
  id         TEXT PRIMARY KEY,
  ticket_id  TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL REFERENCES users(id),
  is_staff   INTEGER NOT NULL DEFAULT 0,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
