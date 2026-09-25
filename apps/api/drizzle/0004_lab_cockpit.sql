-- Lab cockpit: nested accord lines
ALTER TABLE lab.formula_lines
  ADD COLUMN IF NOT EXISTS child_formula_id uuid REFERENCES lab.formulas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS formula_lines_child_formula_idx
  ON lab.formula_lines (child_formula_id)
  WHERE child_formula_id IS NOT NULL;

-- Mark library accords (reusable sub-recipes)
ALTER TABLE lab.formulas
  ADD COLUMN IF NOT EXISTS is_library_accord boolean NOT NULL DEFAULT false;
