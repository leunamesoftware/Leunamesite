-- Contrato do professor: aceito antes de enviar o perfil para verificação (versão + quando).
ALTER TABLE instructor_profiles ADD COLUMN agreement_version TEXT;
ALTER TABLE instructor_profiles ADD COLUMN agreement_accepted_at TEXT;
INSERT INTO platform_settings (key, value, updated_at) VALUES ('legal.instructor_agreement_version', '"2026-10-02"', '2026-10-02T00:00:00.000Z');
