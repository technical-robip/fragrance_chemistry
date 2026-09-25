export function FlagRo({ title = 'Română' }: { title?: string }) {
  return (
    <svg viewBox="0 0 60 45" width="20" height="15" role="img" aria-label={title}>
      <rect width="20" height="45" fill="#002B7F" />
      <rect x="20" width="20" height="45" fill="#FCD116" />
      <rect x="40" width="20" height="45" fill="#CE1126" />
    </svg>
  );
}
