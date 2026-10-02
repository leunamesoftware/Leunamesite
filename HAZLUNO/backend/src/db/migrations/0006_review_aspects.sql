-- Avaliação detalhada (tela "Evalúa la clase"): nota geral + 4 aspectos + o que mais gostou + resposta do professor.
ALTER TABLE reviews ADD COLUMN rating_content INTEGER CHECK (rating_content BETWEEN 1 AND 5);
ALTER TABLE reviews ADD COLUMN rating_teaching INTEGER CHECK (rating_teaching BETWEEN 1 AND 5);
ALTER TABLE reviews ADD COLUMN rating_organization INTEGER CHECK (rating_organization BETWEEN 1 AND 5);
ALTER TABLE reviews ADD COLUMN rating_punctuality INTEGER CHECK (rating_punctuality BETWEEN 1 AND 5);
-- JSON com códigos fixos: clear_explanations, practical_exercises, good_interaction, useful_materials, pleasant_atmosphere, solved_doubts, other
ALTER TABLE reviews ADD COLUMN highlights TEXT NOT NULL DEFAULT '[]';
ALTER TABLE reviews ADD COLUMN instructor_reply TEXT;
ALTER TABLE reviews ADD COLUMN instructor_replied_at TEXT;
