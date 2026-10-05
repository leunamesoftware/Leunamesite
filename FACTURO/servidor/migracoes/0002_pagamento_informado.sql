-- O cliente toca em "Já paguei" na fatura; o profissional confere e confirma no app.
ALTER TABLE links ADD COLUMN pago_informado_em TEXT;
