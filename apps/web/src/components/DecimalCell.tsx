import { useEffect, useRef, useState } from 'react';

export function parseNonNegativeDecimal(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function formatDraft(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return String(value);
}

export function DecimalCell({
  value,
  onCommit,
  className,
  'aria-label': ariaLabel,
}: {
  value: number;
  onCommit: (next: number) => void;
  className?: string;
  'aria-label'?: string;
}) {
  const [draft, setDraft] = useState(() => formatDraft(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(formatDraft(value));
  }, [value]);

  function commit(raw: string) {
    const parsed = parseNonNegativeDecimal(raw);
    if (parsed == null) {
      setDraft(formatDraft(value));
      return;
    }
    setDraft(formatDraft(parsed));
    if (Math.abs(parsed - value) >= 1e-6) onCommit(parsed);
  }

  return (
    <input
      className={className}
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      value={draft}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        focused.current = false;
        commit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
    />
  );
}
