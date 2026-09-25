export function FlagIt({ title = 'Italiano' }: { title?: string }) {
  return (
    <svg viewBox="0 0 60 45" width="20" height="15" role="img" aria-label={title}>
      <rect width="20" height="45" fill="#009246" />
      <rect x="20" width="20" height="45" fill="#fff" />
      <rect x="40" width="20" height="45" fill="#CE2B37" />
    </svg>
  );
}
