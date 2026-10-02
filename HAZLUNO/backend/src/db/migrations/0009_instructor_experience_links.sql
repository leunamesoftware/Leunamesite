-- Perfil profissional do professor: anos de experiência e links de portfólio/redes (sem apps de contato direto).
ALTER TABLE instructor_profiles ADD COLUMN experience TEXT CHECK (experience IN ('lt1', '1_3', '3_5', '5_10', 'gt10'));
ALTER TABLE instructor_profiles ADD COLUMN links TEXT NOT NULL DEFAULT '[]';  -- JSON: [{ "kind": "instagram" | "youtube" | "website", "url": "https://..." }]
