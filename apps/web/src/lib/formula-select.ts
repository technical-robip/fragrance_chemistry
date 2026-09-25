export type FormulaSelectItem = {
  id: string;
  name: string;
  status: string;
};

export function formulaOptionLabel(formula: FormulaSelectItem) {
  return `${formula.name} (${formula.status})`;
}

/** After deleting `deletedId`, which formula should stay/become active. */
export function nextFormulaAfterDelete<T extends { id: string }>(
  formulas: T[],
  deletedId: string,
  selectedId: string | null,
): string | null {
  const remaining = formulas.filter((formula) => formula.id !== deletedId);
  const first = remaining[0];
  if (!first) return null;
  if (selectedId && selectedId !== deletedId) {
    return remaining.some((formula) => formula.id === selectedId) ? selectedId : first.id;
  }
  const index = formulas.findIndex((formula) => formula.id === deletedId);
  if (index < 0) return first.id;
  return remaining[index]?.id ?? remaining[index - 1]?.id ?? first.id;
}
