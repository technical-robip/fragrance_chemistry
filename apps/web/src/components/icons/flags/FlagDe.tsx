export function FlagDe({ title = 'Deutsch' }: { title?: string }) {
  return (
    <svg viewBox="0 0 60 45" width="20" height="15" role="img" aria-label={title}>
      <rect width="60" height="15" fill="#000" />
      <rect y="15" width="60" height="15" fill="#D00" />
      <rect y="30" width="60" height="15" fill="#FFCE00" />
    </svg>
  );
}
