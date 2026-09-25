/**
 * Generates illustrative SVG avatars for every catalog material into
 * apps/web/public/media/materials/art/<slug>.svg
 * Run: node apps/web/scripts/generate-material-avatars.mjs
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const catalogPath = path.join(root, 'apps/api/src/database/data/materials-catalog.json');
const outDir = path.join(root, 'apps/web/public/media/materials/art');

const familyTone = {
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

const noteAccent = {
  top: '#b8f0d4',
  middle: '#f5d9a8',
  heart: '#f5d9a8',
  base: '#cbb6e0',
  modifier: '#9b7bb8',
};

function slugify(input, maxLen = 80) {
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

function uniqueSlug(name, taken, salt) {
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

function hashHue(input) {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h % 40;
}

function initials(name) {
  const parts = name.replace(/\([^)]*\)/g, '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function motif(kind) {
  if (kind === 'citrus') {
    return `<circle cx="32" cy="32" r="10" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="2.5"/>`;
  }
  if (kind === 'floral') {
    return `<g fill="rgba(255,255,255,0.88)"><circle cx="32" cy="22" r="4"/><circle cx="40" cy="28" r="4"/><circle cx="38" cy="38" r="4"/><circle cx="26" cy="38" r="4"/><circle cx="24" cy="28" r="4"/><circle cx="32" cy="32" r="3.2"/></g>`;
  }
  if (kind === 'leaf') {
    return `<path d="M32 16c10 8 14 18 0 32C18 34 22 24 32 16z" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="2.2"/>`;
  }
  if (kind === 'wood') {
    return `<g fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="2"><ellipse cx="32" cy="32" rx="12" ry="8"/><ellipse cx="32" cy="32" rx="7" ry="4.5"/><ellipse cx="32" cy="32" rx="2.5" ry="1.5"/></g>`;
  }
  if (kind === 'amber') {
    return `<path d="M32 18l10 18H22z" fill="rgba(255,255,255,0.88)"/>`;
  }
  if (kind === 'swirl') {
    return `<path d="M22 34c4-10 20-10 20 0s-8 10-10 4" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="2.4" stroke-linecap="round"/>`;
  }
  if (kind === 'star') {
    return `<path d="M32 16l3.5 8.5H44l-7 5.5 2.5 9L32 33l-7.5 6 2.5-9-7-5.5h8.5z" fill="rgba(255,255,255,0.9)"/>`;
  }
  return `<circle cx="32" cy="32" r="9" fill="rgba(255,255,255,0.85)"/>`;
}

function svgFor(name, family, note) {
  const tone = familyTone[family] ?? {
    a: `hsl(${160 + hashHue(name)} 42% 48%)`,
    b: `hsl(${160 + hashHue(name)} 48% 28%)`,
    motif: 'soft',
  };
  const accent = noteAccent[note] ?? 'rgba(255,255,255,0.55)';
  const id = `g${hashHue(name + (family || '') + (note || ''))}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${name.replace(/"/g, '')}">
  <defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${tone.a}"/>
      <stop offset="100%" stop-color="${tone.b}"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="16" fill="url(#${id})"/>
  <circle cx="52" cy="12" r="5" fill="${accent}" opacity="0.9"/>
  ${motif(tone.motif)}
  <text x="32" y="54" text-anchor="middle" font-size="8" font-weight="700" fill="rgba(255,255,255,0.75)" font-family="system-ui,sans-serif">${initials(name)}</text>
</svg>
`;
}

const rows = JSON.parse(readFileSync(catalogPath, 'utf8'));
mkdirSync(outDir, { recursive: true });
const taken = new Set();
let n = 0;
for (const m of rows) {
  const slug = uniqueSlug(m.name, taken, m.manufacturer);
  writeFileSync(path.join(outDir, `${slug}.svg`), svgFor(m.name, m.olfactoryFamily, m.pyramidNote));
  n += 1;
}
console.log(`Wrote ${n} material avatars → ${outDir}`);
