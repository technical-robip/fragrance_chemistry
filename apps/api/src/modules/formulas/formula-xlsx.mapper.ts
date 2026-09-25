import {
  FORMULA_HEADER_FIELDS,
  FORMULA_LINES_COLUMNS,
  FORMULA_WORKBOOK_SCHEMA_VERSION,
  complianceStatusToIfra,
  formulaWorkbookChecksum,
  percentToGrams,
  productTypeFromConcentration,
  pyramidSummaryFromLines,
  toWorkbookLineRow,
  type FormulaHeaderFields,
  type FormulaLineRow,
  type FormulaWorkbookPayload,
  type IfraComplianceRow,
  type MaterialsReferenceRow,
} from '@fc/shared';
import {
  evaluateIfraCompliance,
  type FormulaLine as EngineFormulaLine,
  type IfraCategory,
} from '@fc/formula-engine';
import type { FormulaDetail } from './formulas.service';

export type MaterialSnapshot = {
  id: string;
  slug: string | null;
  name: string;
  casNumber: string | null;
  ownerId: string | null;
  stockConcentrationPct: string | number | null;
  solvent: string | null;
  olfactoryFamily: string | null;
};

export type FormulaXlsxContext = {
  createdBy: string;
  sourceInstance: string;
  ifraCategory: number;
  ifraLimitsByMaterialId: Map<string, number>;
  ifraLimitsByName: Map<string, number>;
  materialsById: Map<string, MaterialSnapshot>;
  exportedAt: Date;
};

function toIso(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function toNum(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseAllergens(profile: unknown): Array<{ name: string; fraction: number }> | undefined {
  if (!profile || typeof profile !== 'object') return undefined;
  const entries = Object.entries(profile as Record<string, unknown>)
    .map(([name, raw]) => {
      const fraction = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(fraction) || fraction <= 0) return null;
      return { name, fraction: fraction > 1 ? fraction / 100 : fraction };
    })
    .filter(Boolean) as Array<{ name: string; fraction: number }>;
  return entries.length ? entries : undefined;
}

function normalizeNote(note: string | null | undefined): string {
  if (note === 'heart') return 'middle';
  if (note === 'top' || note === 'middle' || note === 'base' || note === 'modifier') return note;
  return '';
}

function lookupLimit(
  materialId: string,
  materialName: string,
  ctx: FormulaXlsxContext,
): number | null {
  const byId = ctx.ifraLimitsByMaterialId.get(materialId);
  if (byId != null) return byId;
  const byName = ctx.ifraLimitsByName.get(materialName);
  return byName ?? null;
}

export async function assembleFormulaWorkbookPayload(
  formula: FormulaDetail,
  ctx: FormulaXlsxContext,
): Promise<FormulaWorkbookPayload> {
  const batchTargetGrams = toNum(formula.batchTargetGrams, 10);
  const concentrationPct = toNum(formula.concentrationPct, 20);
  const ifraCategory = String(ctx.ifraCategory || 4);

  const lines: FormulaLineRow[] = formula.lines.map((line) =>
    toWorkbookLineRow(
      {
        id: line.id,
        materialId: line.materialId,
        materialSlug: line.slug,
        materialName: line.materialName,
        casNumber: line.casNumber,
        pyramidNote: normalizeNote(line.pyramidNote),
        percent: toNum(line.percent),
        stockConcentrationPct: toNum(line.stockConcentrationPct, 100),
        solvent: line.solvent,
        manufacturer: line.manufacturer,
        costPerGram: line.costPerGram != null ? toNum(line.costPerGram) : null,
        olfactoryFamily: line.olfactoryFamily,
        allergenProfile: line.allergenProfile,
        ifraLimitPct: lookupLimit(line.materialId, line.materialName, ctx),
      },
      batchTargetGrams,
      concentrationPct,
    ),
  );

  const header: FormulaHeaderFields = {
    formulaId: formula.id,
    slug: formula.slug ?? '',
    name: formula.name,
    version: String(formula.version ?? 1),
    status: formula.status,
    productType: productTypeFromConcentration(concentrationPct),
    batchTargetGrams,
    stockConcentrationPct: concentrationPct,
    solvent: '',
    ifraCategory,
    pyramidSummary: pyramidSummaryFromLines(lines),
    description: formula.description ?? '',
    tags: [],
    createdBy: ctx.createdBy,
    createdAt: toIso(formula.createdAt),
    updatedAt: toIso(formula.updatedAt),
  };

  const engineLines: EngineFormulaLine[] = formula.lines.map((line, idx) => {
    const stockPct = toNum(line.stockConcentrationPct, 100);
    const activeFraction = Math.min(1, Math.max(0, stockPct / 100));
    return {
      id: line.id ?? String(idx),
      materialId: line.materialId,
      label: line.materialName,
      amountGrams: percentToGrams(toNum(line.percent), batchTargetGrams),
      concentrationKind: activeFraction < 0.999 ? 'dilution' : 'neat',
      activeFraction,
      costPerGram: toNum(line.costPerGram ?? 0),
      allergens: parseAllergens(line.allergenProfile),
    };
  });

  const category = (ctx.ifraCategory || 4) as IfraCategory;
  const limits: Record<string, number> = {};
  for (const [name, max] of ctx.ifraLimitsByName) limits[name] = max;
  const report = evaluateIfraCompliance(engineLines, category, {
    [category]: limits,
  } as Parameters<typeof evaluateIfraCompliance>[2]);

  const ifraCompliance: IfraComplianceRow[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    if (line.ifraStatus === 'n/a' || line.ifraLimitPct === '') continue;
    const limit = Number(line.ifraLimitPct);
    const usage = Number(line.ifraUsagePct) || 0;
    const key = `line:${line.materialName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    ifraCompliance.push({
      materialName: line.materialName,
      casNumber: line.casNumber,
      ifraCategory,
      limitPct: limit,
      usagePct: usage,
      marginPct: limit - usage,
      status: line.ifraStatus,
    });
  }
  for (const allergen of report.allergens) {
    const key = `allergen:${allergen.name}`;
    if (seen.has(`line:${allergen.name}`) || seen.has(key)) continue;
    seen.add(key);
    const limit = allergen.limitPercent;
    ifraCompliance.push({
      materialName: allergen.name,
      casNumber: '',
      ifraCategory,
      limitPct: limit != null ? limit : '',
      usagePct: allergen.percentOfBatch,
      marginPct: limit != null ? limit - allergen.percentOfBatch : '',
      status: complianceStatusToIfra(allergen.status),
    });
  }

  const materialsReference: MaterialsReferenceRow[] = [];
  const seenMaterials = new Set<string>();
  for (const line of formula.lines) {
    if (seenMaterials.has(line.materialId)) continue;
    seenMaterials.add(line.materialId);
    const snap = ctx.materialsById.get(line.materialId);
    const dilution = snap?.stockConcentrationPct != null ? toNum(snap.stockConcentrationPct) : '';
    materialsReference.push({
      materialId: line.materialId,
      slug: snap?.slug ?? line.slug ?? '',
      name: snap?.name ?? line.materialName,
      casNumber: snap?.casNumber ?? line.casNumber ?? '',
      isPrivate: Boolean(snap?.ownerId),
      defaultDilutionPct: dilution,
      defaultSolvent: snap?.solvent ?? '',
      odorFamily: snap?.olfactoryFamily ?? line.olfactoryFamily ?? '',
    });
  }

  const checksum = await formulaWorkbookChecksum(lines);
  return {
    header,
    lines,
    ifraCompliance,
    materialsReference,
    meta: {
      schemaVersion: FORMULA_WORKBOOK_SCHEMA_VERSION,
      exportedAt: ctx.exportedAt.toISOString(),
      exportedBy: ctx.createdBy,
      sourceFormulaId: formula.id,
      sourceInstance: ctx.sourceInstance,
      checksum,
      formulaFieldKeys: FORMULA_HEADER_FIELDS.map((field) => field.key),
      formulaLinesColumnKeys: FORMULA_LINES_COLUMNS.map((col) => col.key),
    },
  };
}
