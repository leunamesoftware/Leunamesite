-- Sucatel — permite ao admin bloquear (impedir login, sem apagar dados)
-- uma conta direto do painel admin, além de já existir a exclusão
-- (anonimização) e a verificação.
ALTER TABLE users ADD COLUMN bloqueado INTEGER NOT NULL DEFAULT 0;
