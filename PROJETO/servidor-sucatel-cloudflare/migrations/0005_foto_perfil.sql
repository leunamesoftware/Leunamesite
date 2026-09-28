-- Sucatel — foto de perfil do usuário (real, enviada por upload, mesmo
-- bucket R2 já usado pelas fotos de anúncio).
ALTER TABLE users ADD COLUMN foto_url TEXT;
