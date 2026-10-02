-- Prazo da gravação definido pelo dono na tela "Clase finalizada": 30 dias (continua editável no painel).
UPDATE platform_settings SET value = '30', updated_at = '2026-10-01T00:00:00.000Z' WHERE key = 'recording.retention_days';
