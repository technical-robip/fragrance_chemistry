export type EvaluationSummary = {
  id: string;
  formulaId: string;
  formulaName?: string | null;
  rating: number;
  macerationDay: number | null;
  notes: string | null;
  t0Notes: string | null;
  t30mNotes: string | null;
  t4hNotes: string | null;
  t24hNotes: string | null;
  clarity: string | null;
  opalescence: string | null;
  solubility: string | null;
  lineMarks?: Array<{
    lineId?: string;
    materialId: string;
    mark: 'ok' | 'weak' | 'strong' | 'harsh';
    timepoint?: 't0Notes' | 't30mNotes' | 't4hNotes' | 't24hNotes';
  }> | null;
  createdAt: string;
};

export type EvaluationFilter = {
  /** Free text against formula name and every timepoint/notes field. */
  q?: string;
  /** Maceration day exact match. null/undefined means all days. */
  day?: number | null;
  /** Minimum overall rating (1-5). Defaults to 1 (no floor). */
  minRating?: number;
  /** Restrict to a single formula ("This formula" chip). */
  formulaId?: string | null;
};

export type EvaluationGroup = {
  formulaId: string;
  formulaName: string;
  rows: EvaluationSummary[];
};

/**
 * Client-side filter over the owner-scoped evaluation list. The API already
 * returns rows newest-first, so ordering is preserved.
 */
export function filterEvaluations(
  rows: readonly EvaluationSummary[],
  filter: EvaluationFilter = {},
): EvaluationSummary[] {
  const q = filter.q?.trim().toLowerCase() ?? '';
  const min = filter.minRating ?? 1;
  const day = filter.day;
  return rows.filter((r) => {
    if (filter.formulaId && r.formulaId !== filter.formulaId) return false;
    if (day != null && (r.macerationDay ?? 0) !== day) return false;
    if (r.rating < min) return false;
    if (q) {
      const haystack = [r.formulaName, r.t0Notes, r.t30mNotes, r.t4hNotes, r.t24hNotes, r.notes]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

/**
 * Group already-filtered rows by formula, preserving the incoming order both
 * across groups (first-seen formula first) and within each group.
 */
export function groupByFormula(rows: readonly EvaluationSummary[]): EvaluationGroup[] {
  const groups = new Map<string, EvaluationGroup>();
  for (const row of rows) {
    let group = groups.get(row.formulaId);
    if (!group) {
      group = { formulaId: row.formulaId, formulaName: row.formulaName ?? '—', rows: [] };
      groups.set(row.formulaId, group);
    }
    group.rows.push(row);
  }
  return [...groups.values()];
}
