-- Categorias pedidas nas referências do dono: Arte e Bem-estar.
INSERT INTO categories (id, icon, sort_order) VALUES ('art', 'palette', 13), ('wellness', 'heart', 14);

INSERT INTO category_translations (category_id, language_code, name) VALUES
  ('art', 'pt', 'Arte'), ('art', 'en', 'Art'), ('art', 'es', 'Arte'),
  ('art', 'fr', 'Art'), ('art', 'it', 'Arte'), ('art', 'de', 'Kunst'),
  ('wellness', 'pt', 'Bem-estar'), ('wellness', 'en', 'Wellness'), ('wellness', 'es', 'Bienestar'),
  ('wellness', 'fr', 'Bien-être'), ('wellness', 'it', 'Benessere'), ('wellness', 'de', 'Wohlbefinden');

-- "Outros" continua por último.
UPDATE categories SET sort_order = 15 WHERE id = 'other';
