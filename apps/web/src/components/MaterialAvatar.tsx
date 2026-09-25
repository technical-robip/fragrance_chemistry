import { useEffect, useState } from 'react';
import styles from './MaterialAvatar.module.css';

const familyTone: Record<string, { a: string; b: string; motif: string }> = {
  Floral: { a: '#c4789a', b: '#7a3d5c', motif: 'floral' },
  Fresh: { a: '#6ecf9a', b: '#1f6b4a', motif: 'citrus' },
  Green: { a: '#7dcf6e', b: '#2f6b28', motif: 'leaf' },
  Animalic: { a: '#a67c9a', b: '#4a2f55', motif: 'soft' },
  Woody: { a: '#c4a574', b: '#6b4a28', motif: 'wood' },
  Gourmand: { a: '#d4a574', b: '#8a4f2a', motif: 'swirl' },
  Special: { a: '#7eb8c9', b: '#2a5a6b', motif: 'star' },
  Amber: { a: '#e0a85c', b: '#8a5a18', motif: 'amber' },
  Oriental: { a: '#c4785a', b: '#6b3020', motif: 'amber' },
  Citrus: { a: '#e8c86a', b: '#8a6a18', motif: 'citrus' },
};

function hashHue(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h % 40;
}

function initials(name: string) {
  const parts = name
    .replace(/\([^)]*\)/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function Motif({ kind }: { kind: string }) {
  if (kind === 'citrus') {
    return (
      <circle
        cx="32"
        cy="32"
        r="10"
        fill="none"
        stroke="rgba(255,255,255,0.85)"
        strokeWidth="2.5"
      />
    );
  }
  if (kind === 'floral') {
    return (
      <g fill="rgba(255,255,255,0.88)">
        <circle cx="32" cy="22" r="4" />
        <circle cx="40" cy="28" r="4" />
        <circle cx="38" cy="38" r="4" />
        <circle cx="26" cy="38" r="4" />
        <circle cx="24" cy="28" r="4" />
        <circle cx="32" cy="32" r="3.2" />
      </g>
    );
  }
  if (kind === 'leaf') {
    return (
      <path
        d="M32 16c10 8 14 18 0 32C18 34 22 24 32 16z"
        fill="none"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth="2.2"
      />
    );
  }
  if (kind === 'wood') {
    return (
      <g fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2">
        <ellipse cx="32" cy="32" rx="12" ry="8" />
        <ellipse cx="32" cy="32" rx="7" ry="4.5" />
        <ellipse cx="32" cy="32" rx="2.5" ry="1.5" />
      </g>
    );
  }
  if (kind === 'amber') {
    return <path d="M32 18l10 18H22z" fill="rgba(255,255,255,0.88)" />;
  }
  if (kind === 'swirl') {
    return (
      <path
        d="M22 34c4-10 20-10 20 0s-8 10-10 4"
        fill="none"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    );
  }
  if (kind === 'star') {
    return (
      <path
        d="M32 16l3.5 8.5H44l-7 5.5 2.5 9L32 33l-7.5 6 2.5-9-7-5.5h8.5z"
        fill="rgba(255,255,255,0.9)"
      />
    );
  }
  return <circle cx="32" cy="32" r="9" fill="rgba(255,255,255,0.85)" />;
}

function MotifAvatar({
  name,
  family,
  size,
  className,
}: {
  name: string;
  family?: string | null;
  size: number;
  className?: string;
}) {
  const tone = familyTone[family ?? ''] ?? {
    a: `hsl(${160 + hashHue(name)} 42% 48%)`,
    b: `hsl(${160 + hashHue(name)} 48% 28%)`,
    motif: 'soft',
  };
  return (
    <svg
      className={`${styles.svg} ${className ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={name}
    >
      <defs>
        <linearGradient id={`g-${hashHue(name)}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={tone.a} />
          <stop offset="100%" stopColor={tone.b} />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#g-${hashHue(name)})`} />
      <Motif kind={tone.motif} />
      <text
        x="32"
        y="54"
        textAnchor="middle"
        fontSize="8"
        fontWeight="700"
        fill="rgba(255,255,255,0.75)"
      >
        {initials(name)}
      </text>
    </svg>
  );
}

function artFallbackFromUrl(url: string) {
  const match = url.match(/\/media\/materials\/(?:photos|art)\/([^/.]+)/);
  if (!match) return null;
  const art = `/media/materials/art/${match[1]}.svg`;
  return art === url ? null : art;
}

export function MaterialAvatar({
  name,
  family,
  imageUrl,
  size = 40,
  className,
}: {
  name: string;
  family?: string | null;
  imageUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(imageUrl ?? null);

  useEffect(() => {
    setSrc(imageUrl ?? null);
  }, [imageUrl]);

  if (src) {
    return (
      <img
        key={src}
        src={src}
        alt=""
        width={size}
        height={size}
        className={`${styles.img} ${className ?? ''}`}
        style={{ width: size, height: size }}
        loading="lazy"
        onError={() => {
          const art = artFallbackFromUrl(src);
          setSrc(art);
        }}
      />
    );
  }

  return <MotifAvatar name={name} family={family} size={size} className={className} />;
}
