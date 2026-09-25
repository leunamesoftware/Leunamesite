-- Fase 10: rastreamento. Prazo prometido ao cliente = pagamento + previsão do plano.
ALTER TABLE orders ADD COLUMN eta_max_min INTEGER;
ALTER TABLE orders ADD COLUMN paid_at TEXT;
