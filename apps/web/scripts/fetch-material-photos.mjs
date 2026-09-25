/**
 * Fetches freely-licensed photos for well-known natural materials via Openverse.
 * Saves apps/web/public/media/materials/photos/<slug>.jpg and credits.json.
 * Run: node apps/web/scripts/fetch-material-photos.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const catalogPath = path.join(root, 'apps/api/src/database/data/materials-catalog.json');
const photoDir = path.join(root, 'apps/web/public/media/materials/photos');
const creditsPath = path.join(root, 'apps/web/public/media/materials/credits.json');

const SEARCH = [
  { match: /bergamot/i, q: 'bergamot fruit citrus' },
  { match: /lemon/i, q: 'lemon citrus fruit' },
  { match: /orange/i, q: 'orange citrus fruit' },
  { match: /grapefruit/i, q: 'grapefruit citrus' },
  { match: /lime/i, q: 'lime citrus fruit' },
  { match: /lavender/i, q: 'lavender flowers purple' },
  { match: /rose\b/i, q: 'rose flower petals' },
  { match: /jasmine/i, q: 'jasmine flower white' },
  { match: /ylang/i, q: 'ylang ylang flower' },
  { match: /vetiver/i, q: 'vetiver grass roots' },
  { match: /patchouli/i, q: 'patchouli plant leaves' },
  { match: /sandalwood/i, q: 'sandalwood wood' },
  { match: /cedar/i, q: 'cedar wood tree' },
  { match: /oakmoss|oak moss/i, q: 'oakmoss lichen' },
  { match: /vanilla/i, q: 'vanilla bean pods' },
  { match: /tonka|coumarin/i, q: 'tonka bean' },
  { match: /cinnamon/i, q: 'cinnamon sticks spice' },
  { match: /ginger/i, q: 'ginger root' },
  { match: /cardamom/i, q: 'cardamom pods' },
  { match: /peppermint|spearmint|mint/i, q: 'mint leaves green' },
  { match: /basil/i, q: 'basil leaves' },
  { match: /thyme/i, q: 'thyme herb' },
  { match: /rosemary/i, q: 'rosemary herb' },
  { match: /frankincense/i, q: 'frankincense resin' },
  { match: /myrrh/i, q: 'myrrh resin' },
  { match: /benzoin/i, q: 'benzoin resin' },
  { match: /labdanum/i, q: 'labdanum cistus' },
  { match: /ambergris|ambrox/i, q: 'amber resin' },
  { match: /musk/i, q: 'soft powder texture' },
  { match: /iris|orris/i, q: 'iris flower purple' },
  { match: /violet/i, q: 'violet flower' },
  { match: /neroli|petitgrain/i, q: 'orange blossom flower' },
  { match: /geranium/i, q: 'geranium flower' },
  { match: /clove/i, q: 'clove spice buds' },
  { match: /black pepper|pepper/i, q: 'black peppercorns' },
  { match: /pine|fir|spruce/i, q: 'pine needles evergreen' },
  { match: /oak\b/i, q: 'oak wood bark' },
  { match: /honey/i, q: 'honey golden' },
  { match: /coffee/i, q: 'coffee beans' },
  { match: /cocoa|cacao/i, q: 'cocoa beans chocolate' },
  { match: /tobacco/i, q: 'tobacco leaves' },
  { match: /leather/i, q: 'leather texture brown' },
];

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

function queryFor(name) {
  for (const row of SEARCH) {
    if (row.match.test(name)) return row.q;
  }
  return null;
}

async function searchOpenverse(q) {
  const url = new URL('https://api.openverse.org/v1/images/');
  url.searchParams.set('q', q);
  url.searchParams.set('page_size', '5');
  url.searchParams.set('license_type', 'commercial,modification');
  url.searchParams.set('extension', 'jpg,jpeg,png');
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'FragranceChemistryLab/0.1 (material catalog)' },
  });
  if (!res.ok) throw new Error(`Openverse ${res.status}`);
  const data = await res.json();
  return data.results ?? [];
}

async function download(url, dest) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'FragranceChemistryLab/0.1 (material catalog)' },
  });
  if (!res.ok) throw new Error(`download ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 2000) throw new Error('file too small');
  writeFileSync(dest, buf);
}

mkdirSync(photoDir, { recursive: true });
const rows = JSON.parse(readFileSync(catalogPath, 'utf8'));
const credits = existsSync(creditsPath) ? JSON.parse(readFileSync(creditsPath, 'utf8')) : {};
const taken = new Set();
let saved = 0;
let skipped = 0;
let failed = 0;

for (const m of rows) {
  const slug = uniqueSlug(m.name, taken, m.manufacturer);
  const q = queryFor(m.name);
  if (!q) {
    skipped += 1;
    continue;
  }
  const dest = path.join(photoDir, `${slug}.jpg`);
  if (existsSync(dest) && credits[slug]) {
    skipped += 1;
    continue;
  }
  try {
    const results = await searchOpenverse(q);
    const hit = results.find((r) => r.url || r.thumbnail);
    if (!hit) {
      failed += 1;
      continue;
    }
    const src = hit.url || hit.thumbnail;
    await download(src, dest);
    credits[slug] = {
      title: hit.title ?? m.name,
      creator: hit.creator ?? hit.creator_name ?? 'Unknown',
      license: hit.license ?? hit.license_url ?? 'unknown',
      source: hit.foreign_landing_url ?? hit.url ?? src,
      query: q,
    };
    saved += 1;
    console.log(`photo ${slug}`);
    await new Promise((r) => setTimeout(r, 350));
  } catch (err) {
    failed += 1;
    console.warn(`skip ${slug}: ${err.message}`);
  }
}

writeFileSync(creditsPath, JSON.stringify(credits, null, 2) + '\n');
console.log(`Photos saved=${saved} skipped=${skipped} failed=${failed} → ${photoDir}`);
