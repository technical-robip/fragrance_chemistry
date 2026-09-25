/** Lab navigation query: formula is the job; eval is the sitting being continued. */

export function withLabQuery(
  path: string,
  opts: { formula?: string | null; evalId?: string | null } = {},
): string {
  const qIndex = path.indexOf('?');
  const base = qIndex >= 0 ? path.slice(0, qIndex) : path;
  const rest = qIndex >= 0 ? path.slice(qIndex + 1) : '';
  const params = new URLSearchParams(rest);
  if (opts.formula) params.set('formula', opts.formula);
  if (opts.evalId) params.set('eval', opts.evalId);
  const q = params.toString();
  return q ? `${base}?${q}` : base;
}

export function withFormulaQuery(path: string, formulaKey: string | null | undefined) {
  if (!formulaKey) return path;
  return withLabQuery(path, { formula: formulaKey });
}
