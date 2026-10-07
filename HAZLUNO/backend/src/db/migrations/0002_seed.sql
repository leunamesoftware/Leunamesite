-- Hazluno — dados de referência iniciais.

INSERT INTO languages (code, native_name, sort_order) VALUES
  ('pt', 'Português', 1),
  ('en', 'English', 2),
  ('es', 'Español', 3),
  ('fr', 'Français', 4),
  ('it', 'Italiano', 5),
  ('de', 'Deutsch', 6);

-- Países europeus. A moeda é a local (informativa); a plataforma começa cobrando em EUR.
INSERT INTO countries (code, currency, default_language) VALUES
  ('PT', 'EUR', 'pt'), ('ES', 'EUR', 'es'), ('FR', 'EUR', 'fr'), ('IT', 'EUR', 'it'), ('DE', 'EUR', 'de'),
  ('AT', 'EUR', 'de'), ('BE', 'EUR', 'fr'), ('LU', 'EUR', 'fr'), ('NL', 'EUR', 'en'), ('IE', 'EUR', 'en'),
  ('FI', 'EUR', 'en'), ('GR', 'EUR', 'en'), ('CY', 'EUR', 'en'), ('MT', 'EUR', 'en'), ('SI', 'EUR', 'en'),
  ('SK', 'EUR', 'en'), ('EE', 'EUR', 'en'), ('LV', 'EUR', 'en'), ('LT', 'EUR', 'en'), ('HR', 'EUR', 'en'),
  ('BG', 'EUR', 'en'), ('CH', 'CHF', 'de'), ('GB', 'GBP', 'en'), ('PL', 'PLN', 'en'), ('SE', 'SEK', 'en'),
  ('DK', 'DKK', 'en'), ('NO', 'NOK', 'en'), ('CZ', 'CZK', 'en'), ('HU', 'HUF', 'en'), ('RO', 'RON', 'en'),
  ('IS', 'ISK', 'en');

INSERT INTO categories (id, icon, sort_order) VALUES
  ('culinary', 'chef-hat', 1), ('beauty', 'sparkles', 2), ('music', 'music', 3), ('languages', 'languages', 4),
  ('technology', 'laptop', 5), ('photography', 'camera', 6), ('crafts', 'scissors', 7), ('repairs', 'wrench', 8),
  ('home_diy', 'hammer', 9), ('fitness', 'dumbbell', 10), ('business', 'briefcase', 11), ('other', 'grid', 12);

INSERT INTO category_translations (category_id, language_code, name) VALUES
  ('culinary', 'pt', 'Culinária'), ('culinary', 'en', 'Cooking'), ('culinary', 'es', 'Cocina'),
  ('culinary', 'fr', 'Cuisine'), ('culinary', 'it', 'Cucina'), ('culinary', 'de', 'Kochen'),
  ('beauty', 'pt', 'Beleza'), ('beauty', 'en', 'Beauty'), ('beauty', 'es', 'Belleza'),
  ('beauty', 'fr', 'Beauté'), ('beauty', 'it', 'Bellezza'), ('beauty', 'de', 'Schönheit'),
  ('music', 'pt', 'Música'), ('music', 'en', 'Music'), ('music', 'es', 'Música'),
  ('music', 'fr', 'Musique'), ('music', 'it', 'Musica'), ('music', 'de', 'Musik'),
  ('languages', 'pt', 'Idiomas'), ('languages', 'en', 'Languages'), ('languages', 'es', 'Idiomas'),
  ('languages', 'fr', 'Langues'), ('languages', 'it', 'Lingue'), ('languages', 'de', 'Sprachen'),
  ('technology', 'pt', 'Tecnologia'), ('technology', 'en', 'Technology'), ('technology', 'es', 'Tecnología'),
  ('technology', 'fr', 'Technologie'), ('technology', 'it', 'Tecnologia'), ('technology', 'de', 'Technologie'),
  ('photography', 'pt', 'Fotografia'), ('photography', 'en', 'Photography'), ('photography', 'es', 'Fotografía'),
  ('photography', 'fr', 'Photographie'), ('photography', 'it', 'Fotografia'), ('photography', 'de', 'Fotografie'),
  ('crafts', 'pt', 'Artesanato'), ('crafts', 'en', 'Crafts'), ('crafts', 'es', 'Artesanía'),
  ('crafts', 'fr', 'Artisanat'), ('crafts', 'it', 'Artigianato'), ('crafts', 'de', 'Kunsthandwerk'),
  ('repairs', 'pt', 'Reparos'), ('repairs', 'en', 'Repairs'), ('repairs', 'es', 'Reparaciones'),
  ('repairs', 'fr', 'Réparations'), ('repairs', 'it', 'Riparazioni'), ('repairs', 'de', 'Reparaturen'),
  ('home_diy', 'pt', 'Casa e DIY'), ('home_diy', 'en', 'Home & DIY'), ('home_diy', 'es', 'Hogar y bricolaje'),
  ('home_diy', 'fr', 'Maison et bricolage'), ('home_diy', 'it', 'Casa e fai da te'), ('home_diy', 'de', 'Haus & Heimwerken'),
  ('fitness', 'pt', 'Fitness'), ('fitness', 'en', 'Fitness'), ('fitness', 'es', 'Fitness'),
  ('fitness', 'fr', 'Fitness'), ('fitness', 'it', 'Fitness'), ('fitness', 'de', 'Fitness'),
  ('business', 'pt', 'Negócios'), ('business', 'en', 'Business'), ('business', 'es', 'Negocios'),
  ('business', 'fr', 'Affaires'), ('business', 'it', 'Affari'), ('business', 'de', 'Business'),
  ('other', 'pt', 'Outros'), ('other', 'en', 'Other'), ('other', 'es', 'Otros'),
  ('other', 'fr', 'Autres'), ('other', 'it', 'Altro'), ('other', 'de', 'Sonstiges');

-- Modelo de negócio definido pelo dono (alterável pelo painel administrativo):
--   * professor paga €5,00 por turma aberta;
--   * comissão sobre cada inscrição começa em 0% (o professor recebe o preço da turma, menos a taxa do provedor);
--   * desistência do aluno: retém 50% do valor pago, dividido 50/50 entre Hazluno e professor.
INSERT INTO fee_rules (id, kind, calc, fixed_cents, percent_bp, currency, valid_from, created_at) VALUES
  ('fee-opening-default', 'class_opening_fee', 'fixed', 500, 0, 'EUR', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z'),
  ('fee-commission-default', 'enrollment_commission', 'percent', 0, 0, 'EUR', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z');

INSERT INTO platform_settings (key, value, updated_at) VALUES
  ('class.max_capacity', '25', '2026-10-01T00:00:00.000Z'),
  ('class.min_minutes_between_sessions', '0', '2026-10-01T00:00:00.000Z'),
  ('enrollment.seat_hold_minutes', '15', '2026-10-01T00:00:00.000Z'),
  ('withdrawal.retention_bp', '5000', '2026-10-01T00:00:00.000Z'),
  ('withdrawal.retention_platform_share_bp', '5000', '2026-10-01T00:00:00.000Z'),
  ('live.question_seconds', '30', '2026-10-01T00:00:00.000Z'),
  ('recording.retention_days', '365', '2026-10-01T00:00:00.000Z'),
  ('platform.default_currency', '"EUR"', '2026-10-01T00:00:00.000Z'),
  ('legal.terms_version', '"2026-10-01"', '2026-10-01T00:00:00.000Z'),
  ('legal.privacy_version', '"2026-10-01"', '2026-10-01T00:00:00.000Z');
