export function FlagEs({ title = 'Español' }: { title?: string }) {
  return (
    <svg viewBox="0 0 60 45" width="20" height="15" role="img" aria-label={title}>
      <rect width="60" height="45" fill="#AA151B" />
      <rect y="11.25" width="60" height="22.5" fill="#F1BF00" />
    </svg>
  );
}
