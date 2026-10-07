-- Fase 3 (Stripe Connect). O Stripe Checkout fica aberto no mínimo 30 minutos,
-- então a vaga fica segurada o mesmo tempo (antes: 15).
UPDATE platform_settings SET value = '30', updated_at = '2026-10-02T00:00:00.000Z' WHERE key = 'enrollment.seat_hold_minutes';

-- Cobrança real no provedor (necessária para transferir ao professor depois).
ALTER TABLE payments ADD COLUMN provider_charge_id TEXT;

-- Quando o líquido de uma inscrição já foi transferido ao professor.
ALTER TABLE enrollments ADD COLUMN settled_at TEXT;

CREATE INDEX IF NOT EXISTS idx_enrollments_hold ON enrollments (status, hold_expires_at);
CREATE INDEX IF NOT EXISTS idx_payments_enrollment ON payments (enrollment_id);

-- Endereço da página de pagamento do provedor (para o aluno voltar a ela enquanto a vaga está segurada).
ALTER TABLE payments ADD COLUMN checkout_url TEXT;
