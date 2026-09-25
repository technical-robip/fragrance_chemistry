ALTER TABLE lab.evaluations
  ADD COLUMN IF NOT EXISTS line_marks jsonb;
