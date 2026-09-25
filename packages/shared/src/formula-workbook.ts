import { z } from 'zod';
import { juiceClassFromConcentration } from './dashboard';
import { percentToGrams, neatPercent } from './lab-units';
import { slugify } from './slug';

export const FORMULA_WORKBOOK_SCHEMA_VERSION = '1.0';
export const MAX_FORMULA_EXPORT = 100;
export const FORMULA_WORKBOOK_LIST_SEP = '; ';
export const IFRA_WARNING_RATIO = 0.8;

export const WORKBOOK_TIERS = ['free', 'pro', 'enterprise'] as const;
export type WorkbookTier = (typeof WORKBOOK_TIERS)[number];
export type WorkbookFieldTier = 'all' | 'pro+' | 'enterprise';

export const FORMULA_WORKBOOK_STATUSES = ['draft', 'ready', 'archived'] as const;
export const FORMULA_PRODUCT_TYPES = [
  'parfum',
  'edp',
  'edt',
  'edc',
  'eau_fraiche',
  'solid',
  'oil',
  'other',
] as const;
export const IFRA_LINE_STATUSES = ['ok', 'warning', 'exceeded', 'n/a'] as const;
export const IFRA_REPORT_STATUSES = ['ok', 'warning', 'exceeded'] as const;

export type IfraLineStatus = (typeof IFRA_LINE_STATUSES)[number];
export type IfraReportStatus = (typeof IFRA_REPORT_STATUSES)[number];

export type WorkbookFieldDef = {
  key: string;
  label: string;
  type: string;
  editable?: boolean;
  required?: boolean;
  tier: WorkbookFieldTier;
  hidden?: boolean;
};

export type WorkbookSheetDef = {
  name: string;
  type: 'keyValue' | 'table';
  description: string;
  hidden?: boolean;
  tier?: WorkbookFieldTier;
  importBehavior?: 'ignored';
  primaryKey?: string;
  fields?: WorkbookFieldDef[];
  columns?: WorkbookFieldDef[];
};

export const FORMULA_HEADER_FIELDS: WorkbookFieldDef[] = [
  { key: 'formulaId', label: 'Formula ID', type: 'string', editable: false, tier: 'all' },
  { key: 'slug', label: 'Slug', type: 'string', editable: false, tier: 'all' },
  { key: 'name', label: 'Name', type: 'string', required: true, tier: 'all' },
  { key: 'version', label: 'Version', type: 'string', tier: 'all' },
  { key: 'status', label: 'Status', type: 'enum', tier: 'all' },
  { key: 'productType', label: 'Product type', type: 'enum', tier: 'all' },
  {
    key: 'batchTargetGrams',
    label: 'Batch target (g)',
    type: 'number',
    required: true,
    tier: 'all',
  },
  {
    key: 'stockConcentrationPct',
    label: 'Concentrate in finished product %',
    type: 'number',
    tier: 'all',
  },
  { key: 'solvent', label: 'Solvent', type: 'string', tier: 'all' },
  { key: 'ifraCategory', label: 'IFRA category', type: 'enum', tier: 'pro+' },
  { key: 'pyramidSummary', label: 'Pyramid summary', type: 'object', tier: 'all' },
  { key: 'description', label: 'Description', type: 'text', tier: 'all' },
  { key: 'tags', label: 'Tags', type: 'string[]', tier: 'pro+' },
  { key: 'createdBy', label: 'Created by', type: 'string', editable: false, tier: 'enterprise' },
  { key: 'createdAt', label: 'Created at', type: 'datetime', editable: false, tier: 'all' },
  { key: 'updatedAt', label: 'Updated at', type: 'datetime', editable: false, tier: 'all' },
];

export const FORMULA_LINES_COLUMNS: WorkbookFieldDef[] = [
  { key: 'lineId', label: 'Line ID', type: 'string', editable: false, tier: 'all' },
  {
    key: 'materialIdOrSlug',
    label: 'Material ID or slug',
    type: 'string',
    required: true,
    tier: 'all',
  },
  { key: 'materialName', label: 'Material name', type: 'string', required: true, tier: 'all' },
  { key: 'casNumber', label: 'CAS', type: 'string', tier: 'pro+' },
  { key: 'notePosition', label: 'Note', type: 'enum', tier: 'all' },
  {
    key: 'percentConcentrate',
    label: '% concentrate',
    type: 'number',
    required: true,
    tier: 'all',
  },
  { key: 'grams', label: 'Grams', type: 'number', editable: false, tier: 'all' },
  { key: 'materialDilutionPct', label: 'Material dilution %', type: 'number', tier: 'pro+' },
  { key: 'materialSolvent', label: 'Material solvent', type: 'string', tier: 'pro+' },
  { key: 'supplier', label: 'Supplier', type: 'string', tier: 'pro+' },
  { key: 'supplierSku', label: 'Supplier SKU', type: 'string', tier: 'enterprise' },
  { key: 'costPerKg', label: 'Cost / kg', type: 'number', tier: 'enterprise' },
  {
    key: 'costContribution',
    label: 'Cost contribution',
    type: 'number',
    editable: false,
    tier: 'enterprise',
  },
  { key: 'odorDescriptors', label: 'Odor descriptors', type: 'string[]', tier: 'all' },
  { key: 'allergenFlags', label: 'Allergen flags', type: 'string[]', tier: 'pro+' },
  { key: 'ifraLimitPct', label: 'IFRA limit %', type: 'number', editable: false, tier: 'pro+' },
  { key: 'ifraUsagePct', label: 'IFRA usage %', type: 'number', editable: false, tier: 'pro+' },
  { key: 'ifraStatus', label: 'IFRA status', type: 'enum', editable: false, tier: 'pro+' },
  { key: 'lineNotes', label: 'Line notes', type: 'text', tier: 'all' },
];

export const IFRA_COMPLIANCE_COLUMNS: WorkbookFieldDef[] = [
  { key: 'materialName', label: 'Material / allergen', type: 'string', tier: 'all' },
  { key: 'casNumber', label: 'CAS', type: 'string', tier: 'all' },
  { key: 'ifraCategory', label: 'IFRA category', type: 'string', tier: 'all' },
  { key: 'limitPct', label: 'Limit %', type: 'number', tier: 'all' },
  { key: 'usagePct', label: 'Usage %', type: 'number', tier: 'all' },
  { key: 'marginPct', label: 'Margin %', type: 'number', tier: 'all' },
  { key: 'status', label: 'Status', type: 'enum', tier: 'all' },
];

export const MATERIALS_REFERENCE_COLUMNS: WorkbookFieldDef[] = [
  { key: 'materialId', label: 'Material ID', type: 'string', tier: 'all' },
  { key: 'slug', label: 'Slug', type: 'string', tier: 'all' },
  { key: 'name', label: 'Name', type: 'string', tier: 'all' },
  { key: 'casNumber', label: 'CAS', type: 'string', tier: 'all' },
  { key: 'isPrivate', label: 'Private', type: 'boolean', tier: 'all' },
  { key: 'defaultDilutionPct', label: 'Default dilution %', type: 'number', tier: 'all' },
  { key: 'defaultSolvent', label: 'Default solvent', type: 'string', tier: 'all' },
  { key: 'odorFamily', label: 'Odor family', type: 'string', tier: 'all' },
];

export const META_FIELDS: WorkbookFieldDef[] = [
  { key: 'schemaVersion', label: 'Schema version', type: 'string', tier: 'all' },
  { key: 'exportedAt', label: 'Exported at', type: 'datetime', tier: 'all' },
  { key: 'exportedBy', label: 'Exported by', type: 'string', tier: 'all' },
  { key: 'sourceFormulaId', label: 'Source formula ID', type: 'string', tier: 'all' },
  { key: 'sourceInstance', label: 'Source instance', type: 'string', tier: 'all' },
  { key: 'checksum', label: 'Checksum', type: 'string', tier: 'all' },
  { key: 'formulaFieldKeys', label: 'Formula field keys', type: 'string[]', tier: 'all' },
  {
    key: 'formulaLinesColumnKeys',
    label: 'Formula line column keys',
    type: 'string[]',
    tier: 'all',
  },
];

export const FORMULA_WORKBOOK_SHEETS: WorkbookSheetDef[] = [
  {
    name: 'Formula',
    type: 'keyValue',
    description: 'Formula metadata, single key-value block',
    fields: FORMULA_HEADER_FIELDS,
  },
  {
    name: 'Formula_Lines',
    type: 'table',
    description: 'Canonical formula rows for re-import',
    primaryKey: 'lineId',
    columns: FORMULA_LINES_COLUMNS,
  },
  {
    name: 'IFRA_Compliance',
    type: 'table',
    tier: 'pro+',
    description: 'Read-only compliance report regenerated on export',
    columns: IFRA_COMPLIANCE_COLUMNS,
    importBehavior: 'ignored',
  },
  {
    name: 'Materials_Reference',
    type: 'table',
    tier: 'enterprise',
    description: 'Catalog snapshot of materials used in the formula',
    columns: MATERIALS_REFERENCE_COLUMNS,
    importBehavior: 'ignored',
  },
  {
    name: '_meta',
    type: 'keyValue',
    hidden: true,
    description: 'Roundtrip metadata — hidden from the user',
    fields: META_FIELDS,
  },
];

export const FORMULA_WORKBOOK_IMPORT_RULES = {
  matchStrategy: ['materialIdOrSlug', 'casNumber', 'materialName+supplier fallback fuzzy'],
  onUnmatchedMaterial: 'create private material with warning',
  onSchemaVersionMismatch:
    'accept previous versions with migration, reject unknown future versions',
  recalculateOnImport: ['grams', 'ifraUsagePct', 'ifraStatus', 'costContribution'],
  readOnlySheets: ['IFRA_Compliance', 'Materials_Reference'],
} as const;

export const FORMULA_LINE_CHECKSUM_KEYS = [
  'lineId',
  'materialIdOrSlug',
  'materialName',
  'casNumber',
  'notePosition',
  'percentConcentrate',
  'materialDilutionPct',
  'materialSolvent',
  'supplier',
  'supplierSku',
  'costPerKg',
  'odorDescriptors',
  'allergenFlags',
  'lineNotes',
] as const;

export const exportFormulasBodySchema = z
  .object({
    formulaIds: z.array(z.string().uuid()).max(MAX_FORMULA_EXPORT).optional(),
    all: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.all === true) return;
    if (!value.formulaIds || value.formulaIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide formulaIds or set all to true',
        path: ['formulaIds'],
      });
    }
  });

export type ExportFormulasBody = z.infer<typeof exportFormulasBodySchema>;

export type PyramidSummary = { top: string; middle: string; base: string };

export type FormulaHeaderFields = {
  formulaId: string;
  slug: string;
  name: string;
  version: string;
  status: (typeof FORMULA_WORKBOOK_STATUSES)[number] | string;
  productType: string;
  batchTargetGrams: number;
  stockConcentrationPct: number;
  solvent: string;
  ifraCategory: string;
  pyramidSummary: PyramidSummary;
  description: string;
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type FormulaLineRow = {
  lineId: string;
  materialIdOrSlug: string;
  materialName: string;
  casNumber: string;
  notePosition: string;
  percentConcentrate: number;
  grams: number;
  materialDilutionPct: number;
  materialSolvent: string;
  supplier: string;
  supplierSku: string;
  costPerKg: number | '';
  costContribution: number | '';
  odorDescriptors: string[];
  allergenFlags: string[];
  ifraLimitPct: number | '';
  ifraUsagePct: number | '';
  ifraStatus: IfraLineStatus;
  lineNotes: string;
};

export type IfraComplianceRow = {
  materialName: string;
  casNumber: string;
  ifraCategory: string;
  limitPct: number | '';
  usagePct: number;
  marginPct: number | '';
  status: IfraReportStatus;
};

export type MaterialsReferenceRow = {
  materialId: string;
  slug: string;
  name: string;
  casNumber: string;
  isPrivate: boolean;
  defaultDilutionPct: number | '';
  defaultSolvent: string;
  odorFamily: string;
};

export type FormulaWorkbookMeta = {
  schemaVersion: string;
  exportedAt: string;
  exportedBy: string;
  sourceFormulaId: string;
  sourceInstance: string;
  checksum: string;
  formulaFieldKeys: string[];
  formulaLinesColumnKeys: string[];
};

export type FormulaWorkbookPayload = {
  header: FormulaHeaderFields;
  lines: FormulaLineRow[];
  ifraCompliance: IfraComplianceRow[];
  materialsReference: MaterialsReferenceRow[];
  meta: FormulaWorkbookMeta;
};

export function workbookTierFromEntitlements(
  planSlug: string | null | undefined,
  features: readonly string[] = [],
): WorkbookTier {
  const slug = (planSlug ?? '').toLowerCase();
  if (slug === 'enterprise' || features.includes('sponsored_listings')) return 'enterprise';
  if (slug === 'pro' || features.includes('costing') || features.includes('pdf_export'))
    return 'pro';
  if (slug === 'free') return 'free';
  if (features.includes('costing') || features.includes('pdf_export')) return 'pro';
  return 'free';
}

export function isFieldHiddenForTier(
  field: Pick<WorkbookFieldDef, 'tier'>,
  tier: WorkbookTier,
): boolean {
  if (field.tier === 'all') return false;
  if (field.tier === 'pro+') return tier === 'free';
  return tier !== 'enterprise';
}

export function isSheetHiddenForTier(sheet: WorkbookSheetDef, tier: WorkbookTier): boolean {
  if (sheet.hidden) return true;
  if (!sheet.tier) return false;
  return isFieldHiddenForTier({ tier: sheet.tier }, tier);
}

export function columnsVisibleForTier(
  columns: readonly WorkbookFieldDef[],
  tier: WorkbookTier,
): WorkbookFieldDef[] {
  return columns.filter((column) => !isFieldHiddenForTier(column, tier));
}

export function parseWorkbookSchemaVersion(
  version: string,
): { major: number; minor: number } | null {
  const match = /^(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]) };
}

/** Previous 1.x versions are accepted; unknown future versions are rejected. */
export function isSupportedWorkbookSchemaVersion(version: string): boolean {
  const parsed = parseWorkbookSchemaVersion(version);
  const current = parseWorkbookSchemaVersion(FORMULA_WORKBOOK_SCHEMA_VERSION);
  if (!parsed || !current) return false;
  if (parsed.major !== current.major) return false;
  return parsed.minor <= current.minor;
}

export function productTypeFromConcentration(concentrationPct: number): string {
  const juice = juiceClassFromConcentration(concentrationPct);
  if (juice === 'extrait') return 'parfum';
  return juice;
}

export function pyramidSummaryFromLines(
  lines: Array<{ notePosition?: string | null; materialName: string }>,
): PyramidSummary {
  const collect = (note: string) =>
    lines
      .filter((line) => line.notePosition === note)
      .map((line) => line.materialName)
      .filter(Boolean)
      .join(', ');
  return {
    top: collect('top'),
    middle: collect('middle'),
    base: collect('base'),
  };
}

export function allergenFlagsFromProfile(profile: unknown): string[] {
  if (!profile || typeof profile !== 'object') return [];
  return Object.entries(profile as Record<string, unknown>)
    .filter(([, raw]) => Number(raw) > 0)
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b));
}

export function ifraUsageInFinishedPct(
  percentConcentrate: number,
  concentrationPct: number,
  materialDilutionPct: number,
): number {
  const dilution = Number.isFinite(materialDilutionPct) ? materialDilutionPct : 100;
  return neatPercent(percentConcentrate, dilution) * (concentrationPct / 100);
}

export function ifraLineStatus(
  usagePct: number,
  limitPct: number | null | undefined,
): IfraLineStatus {
  if (limitPct == null || !Number.isFinite(limitPct)) return 'n/a';
  if (limitPct <= 0) return usagePct > 0 ? 'exceeded' : 'n/a';
  if (usagePct > limitPct) return 'exceeded';
  if (usagePct >= limitPct * IFRA_WARNING_RATIO) return 'warning';
  return 'ok';
}

export function complianceStatusToIfra(
  status: 'green' | 'yellow' | 'red' | string,
): IfraReportStatus {
  if (status === 'red') return 'exceeded';
  if (status === 'yellow') return 'warning';
  return 'ok';
}

export function joinWorkbookList(values: readonly string[]): string {
  return values.filter(Boolean).join(FORMULA_WORKBOOK_LIST_SEP);
}

export function formatWorkbookScalar(value: unknown): string | number | boolean {
  if (value == null) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return joinWorkbookList(value.map((item) => String(item)));
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function formulaWorkbookFilename(nameOrSlug: string): string {
  return `${slugify(nameOrSlug).slice(0, 60) || 'formula'}.xlsx`;
}

export function canonicalLinesForChecksum(
  lines: Array<Pick<FormulaLineRow, (typeof FORMULA_LINE_CHECKSUM_KEYS)[number]>>,
): Array<Record<(typeof FORMULA_LINE_CHECKSUM_KEYS)[number], unknown>> {
  return [...lines]
    .map((line) => {
      const row = {} as Record<(typeof FORMULA_LINE_CHECKSUM_KEYS)[number], unknown>;
      for (const key of FORMULA_LINE_CHECKSUM_KEYS) {
        const value = line[key];
        row[key] = Array.isArray(value) ? [...value] : value;
      }
      return row;
    })
    .sort((a, b) => String(a.lineId).localeCompare(String(b.lineId)));
}

export async function formulaWorkbookChecksum(
  lines: Array<Pick<FormulaLineRow, (typeof FORMULA_LINE_CHECKSUM_KEYS)[number]>>,
): Promise<string> {
  const payload = JSON.stringify(canonicalLinesForChecksum(lines));
  const encoded = new TextEncoder().encode(payload);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export type FormulaLineExportInput = {
  id: string;
  materialId: string;
  materialSlug?: string | null;
  materialName: string;
  casNumber?: string | null;
  pyramidNote?: string | null;
  percent: number;
  stockConcentrationPct?: number | null;
  solvent?: string | null;
  manufacturer?: string | null;
  costPerGram?: number | null;
  olfactoryFamily?: string | null;
  allergenProfile?: unknown;
  ifraLimitPct?: number | null;
};

export function toWorkbookLineRow(
  input: FormulaLineExportInput,
  batchTargetGrams: number,
  concentrationPct: number,
): FormulaLineRow {
  const percent = Number(input.percent) || 0;
  const dilution = Number(input.stockConcentrationPct ?? 100) || 100;
  const grams = percentToGrams(percent, batchTargetGrams);
  const costPerGram = input.costPerGram != null ? Number(input.costPerGram) : null;
  const usage = ifraUsageInFinishedPct(percent, concentrationPct, dilution);
  const limit = input.ifraLimitPct != null ? Number(input.ifraLimitPct) : null;
  return {
    lineId: input.id,
    materialIdOrSlug: input.materialSlug?.trim() || input.materialId,
    materialName: input.materialName,
    casNumber: input.casNumber ?? '',
    notePosition: input.pyramidNote ?? '',
    percentConcentrate: percent,
    grams,
    materialDilutionPct: dilution,
    materialSolvent: input.solvent ?? '',
    supplier: input.manufacturer ?? '',
    supplierSku: '',
    costPerKg: costPerGram != null && Number.isFinite(costPerGram) ? costPerGram * 1000 : '',
    costContribution:
      costPerGram != null && Number.isFinite(costPerGram) ? grams * costPerGram : '',
    odorDescriptors: input.olfactoryFamily ? [input.olfactoryFamily] : [],
    allergenFlags: allergenFlagsFromProfile(input.allergenProfile),
    ifraLimitPct: limit != null && Number.isFinite(limit) ? limit : '',
    ifraUsagePct: limit != null && Number.isFinite(limit) ? usage : '',
    ifraStatus: ifraLineStatus(usage, limit),
    lineNotes: '',
  };
}
