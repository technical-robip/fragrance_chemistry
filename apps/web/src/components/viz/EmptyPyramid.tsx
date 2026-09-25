export function EmptyPyramid() {
  return (
    <svg width="120" height="88" viewBox="0 0 120 88" aria-hidden>
      <polygon
        points="60,6 100,30 20,30"
        fill="none"
        stroke="var(--fc-note-top)"
        strokeWidth="1.5"
        opacity="0.55"
      />
      <polygon
        points="28,34 92,34 104,58 16,58"
        fill="none"
        stroke="var(--fc-note-heart)"
        strokeWidth="1.5"
        opacity="0.55"
      />
      <polygon
        points="18,62 102,62 112,82 8,82"
        fill="none"
        stroke="var(--fc-note-base)"
        strokeWidth="1.5"
        opacity="0.55"
      />
    </svg>
  );
}
