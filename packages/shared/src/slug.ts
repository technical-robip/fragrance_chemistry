/** URL-safe slug for SEO paths (`bergamot-eo`, `lavender-eo-givaudan`). */
export function slugify(input: string, maxLen = 80): string {
  const base = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen)
    .replace(/-+$/g, '');
  return base || 'material';
}

/** Stable unique slug given existing set (adds -2, -3…). */
export function uniqueSlug(name: string, taken: Set<string>, salt?: string): string {
  let base = slugify(salt ? `${name}-${salt}` : name);
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  const out = `${base}-${n}`;
  taken.add(out);
  return out;
}
