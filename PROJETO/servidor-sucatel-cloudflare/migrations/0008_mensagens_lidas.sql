-- Sucatel — controle real de mensagem lida/não lida, pra mostrar contador
-- de não lidas na aba de Chat (em vez de nenhum contador ou um fake).
ALTER TABLE mensagens ADD COLUMN lida INTEGER NOT NULL DEFAULT 0;
