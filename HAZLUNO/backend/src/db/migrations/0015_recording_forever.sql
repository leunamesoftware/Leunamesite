-- Regra do dono (2 out 2026): a gravação de cada aula fica disponível PARA SEMPRE para os alunos inscritos
-- revisarem quantas vezes quiserem. null = sem prazo de exclusão.
UPDATE platform_settings SET value = 'null', updated_at = '2026-10-02T00:00:00.000Z' WHERE key = 'recording.retention_days';
