import { readFileSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { draftFromOverviewFields, type IfraStandardDraft } from '@fc/shared';

export type PositionedText = {
  str: string;
  x: number;
  y: number;
};

const COLUMN_X: Array<[string, number]> = [
  ['code', 50],
  ['amendment', 67],
  ['publicationYears', 78],
  ['lastYear', 92],
  ['deadlineExisting', 105],
  ['deadlineNew', 121],
  ['name', 144],
  ['cas', 174],
  ['casComment', 196],
  ['synonyms', 230],
  ['type', 265],
  ['risk', 274],
  ['flavor', 292],
  ['prohibitedNotes', 350],
  ['phototoxicity', 375],
  ['restriction', 420],
  ['specification', 448],
  ['otherSources', 484],
  ['otherSourcesNote', 499],
  ['limit:1', 514],
  ['limit:2', 527],
  ['limit:3', 541],
  ['limit:4', 554],
  ['limit:5A', 566],
  ['limit:5B', 579],
  ['limit:5C', 593],
  ['limit:5D', 606],
  ['limit:6', 620],
  ['limit:7A', 632],
  ['limit:7B', 645],
  ['limit:8', 659],
  ['limit:9', 672],
  ['limit:10A', 684],
  ['limit:10B', 697],
  ['limit:11A', 711],
  ['limit:11B', 724],
  ['limit:12', 738],
];

function nearestColumn(x: number): string | null {
  let best: { key: string; distance: number } | null = null;
  for (const [key, center] of COLUMN_X) {
    const distance = Math.abs(x - center);
    if (!best || distance < best.distance) best = { key, distance };
  }
  return best && best.distance <= 18 ? best.key : null;
}

function joinFragments(parts: Array<{ y: number; str: string }>, key: string): string {
  const ordered = [...parts].sort((a, b) => b.y - a.y);
  if (key === 'type') return ordered.map((part) => part.str.trim()).join('');
  return ordered
    .map((part) => part.str.trim())
    .filter(Boolean)
    .join('\n');
}

/** Group positioned glyphs into one overview record per IFRA_STD anchor. */
export function standardsFromPositionedText(items: readonly PositionedText[]): IfraStandardDraft[] {
  const anchors = items
    .filter((item) => /^IFRA_STD_\d+/.test(item.str.trim()) && item.x < 80)
    .map((item) => ({ code: item.str.trim().match(/IFRA_STD_\d+/)?.[0] ?? '', y: item.y }))
    .sort((a, b) => b.y - a.y);

  const buckets = new Map<string, Map<string, Array<{ y: number; str: string }>>>();
  for (const anchor of anchors) buckets.set(anchor.code, new Map());

  for (const item of items) {
    const text = item.str.trim();
    if (!text) continue;
    const anchorIndex = anchors.findIndex(
      (anchor, index) =>
        item.y <= anchor.y + 1.2 &&
        (index === anchors.length - 1 || item.y > anchors[index + 1]!.y + 0.4),
    );
    if (anchorIndex < 0) continue;
    const column = nearestColumn(item.x);
    if (!column) continue;
    const anchor = anchors[anchorIndex]!;
    const columns = buckets.get(anchor.code)!;
    const list = columns.get(column) ?? [];
    list.push({ y: item.y, str: text });
    columns.set(column, list);
  }

  const drafts: IfraStandardDraft[] = [];
  for (const anchor of anchors) {
    const fields: Record<string, string> = {};
    for (const [key, parts] of buckets.get(anchor.code) ?? []) {
      fields[key] = joinFragments(parts, key);
    }
    fields.code = anchor.code;
    const flavorStart = 'Due to the possible ingestion';
    if (fields.risk?.includes(flavorStart)) {
      const index = fields.risk.indexOf(flavorStart);
      const tail = fields.risk.slice(index).trim();
      fields.risk = fields.risk.slice(0, index).trim();
      if (!fields.flavor?.includes(flavorStart)) {
        fields.flavor = [tail, fields.flavor].filter(Boolean).join('\n');
      }
    }
    const draft = draftFromOverviewFields(fields);
    if (draft) drafts.push(draft);
  }
  return drafts;
}

type PdfTextItem = {
  str?: string;
  transform?: number[];
};

export async function parseIfraOverviewPdf(buffer: Buffer): Promise<IfraStandardDraft[]> {
  const doc = await getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: true,
    disableWorker: true,
  } as Parameters<typeof getDocument>[0]).promise;
  const drafts: IfraStandardDraft[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const items: PositionedText[] = [];
    for (const raw of content.items as PdfTextItem[]) {
      const str = raw.str?.trim();
      const transform = raw.transform;
      if (!str || !transform) continue;
      items.push({ str, x: transform[4] ?? 0, y: transform[5] ?? 0 });
    }
    drafts.push(...standardsFromPositionedText(items));
  }
  return drafts;
}

export async function parseIfraOverviewPdfFile(filePath: string): Promise<IfraStandardDraft[]> {
  return parseIfraOverviewPdf(readFileSync(filePath));
}
