-- Notas privadas do professor sobre um aluno ("Gestionar alumnos"). Só o próprio professor lê.
CREATE TABLE instructor_student_notes (
  instructor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note          TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  PRIMARY KEY (instructor_id, student_id)
);
