-- Cadastro do professor em 4 passos: telefone e cidade (necessários para a verificação; não são públicos).
ALTER TABLE instructor_profiles ADD COLUMN phone TEXT;
ALTER TABLE instructor_profiles ADD COLUMN city TEXT;
