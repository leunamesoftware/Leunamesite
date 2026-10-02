-- Certificado: Hazluno emite e registra; o professor responde pela formação e aprova; o aluno recebe ao cumprir os critérios da turma.
-- "code" passa a ser o ID público legível (HZ-AAAA-NNNNNN). A verificação completa (com o nome do aluno) exige também a chave do QR Code.

ALTER TABLE certificates ADD COLUMN kind TEXT NOT NULL DEFAULT 'completion' CHECK (kind IN ('completion', 'participation'));
ALTER TABLE certificates ADD COLUMN total_minutes INTEGER;            -- carga horária realmente ministrada (soma dos encontros)
ALTER TABLE certificates ADD COLUMN language_code TEXT;
ALTER TABLE certificates ADD COLUMN completed_on TEXT;                -- data de conclusão (fim do último encontro)
ALTER TABLE certificates ADD COLUMN instructor_approved_at TEXT;      -- professor aprovou a emissão (responsável pela formação)
ALTER TABLE certificates ADD COLUMN issuer_name TEXT NOT NULL DEFAULT 'Hazluno';
ALTER TABLE certificates ADD COLUMN verify_key_hash TEXT;             -- hash da chave que vai no QR Code

-- Numeração anual sem buracos: HZ-2026-000001, HZ-2026-000002...
CREATE TABLE certificate_sequences (
  year INTEGER PRIMARY KEY,
  last INTEGER NOT NULL DEFAULT 0
);

-- Critério da turma (o professor define; padrão = 80% de presença e todos os encontros encerrados).
INSERT INTO platform_settings (key, value, updated_at) VALUES
  ('certificate.require_instructor_approval', 'true', '2026-10-01T00:00:00.000Z'),
  ('certificate.id_prefix', '"HZ"', '2026-10-01T00:00:00.000Z');
