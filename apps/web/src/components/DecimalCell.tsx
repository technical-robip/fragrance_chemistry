import { useEffect, useRef, useState } from 'react';

/**
 * Parse a non-negative decimal from keyboard or numpad input.
 * Accepts either `.` or `,` as the decimal separator.
 */
export function parseNonNegativeDecimal(raw: string): number | null {
  let normalized = raw.trim().replace(/\s/g, '');
  if (!normalized) return null;

  // Trailing separator left mid-typing ("1," / "1.") → treat as the integer part.
  if (normalized.endsWith(',') || normalized.endsWith('.')) {
    normalized = normalized.slice(0, -1);
    if (!normalized) return null;
  }

  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');

  if (lastComma >= 0 && lastDot >= 0) {
    // Mixed separators: the last one is the decimal; earlier ones are thousands.
    if (lastComma > lastDot) {
      normalized =
        normalized.slice(0, lastComma).replace(/[.,]/g, '') +
        '.' +
        normalized.slice(lastComma + 1).replace(/[.,]/g, '');
    } else {
      normalized =
        normalized.slice(0, lastDot).replace(/[.,]/g, '') +
        '.' +
        normalized.slice(lastDot + 1).replace(/[.,]/g, '');
    }
  } else if (lastComma >= 0) {
    // Only commas: last is decimal (numpad / RO-DE-FR), earlier are thousands.
    normalized =
      normalized.slice(0, lastComma).replace(/,/g, '') + '.' + normalized.slice(lastComma + 1);
  } else if ((normalized.match(/\./g) ?? []).length > 1) {
    // Multiple dots: last is decimal (EU thousands with `.`).
    normalized =
      normalized.slice(0, lastDot).replace(/\./g, '') + '.' + normalized.slice(lastDot + 1);
  }

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
