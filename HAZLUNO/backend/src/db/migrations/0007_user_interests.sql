-- "Áreas de interés" do perfil (ids de categorias), usadas para recomendar cursos.
ALTER TABLE users ADD COLUMN interests TEXT NOT NULL DEFAULT '[]';
