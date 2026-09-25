export function FlagEn({ title = 'English' }: { title?: string }) {
  return (
    <svg viewBox="0 0 60 45" width="20" height="15" role="img" aria-label={title}>
      <rect width="60" height="45" fill="#012169" />
      <path d="M0 0 L60 45 M60 0 L0 45" stroke="#fff" strokeWidth="9" />
      <path d="M0 0 L60 45 M60 0 L0 45" stroke="#C8102E" strokeWidth="5" />
      <path d="M30 0 V45 M0 22.5 H60" stroke="#fff" strokeWidth="15" />
      <path d="M30 0 V45 M0 22.5 H60" stroke="#C8102E" strokeWidth="9" />
    </svg>
  );
}
