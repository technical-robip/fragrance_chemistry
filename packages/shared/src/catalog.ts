import { z } from 'zod';

export const pyramidNoteFilterSchema = z.enum(['top', 'middle', 'base', 'modifier']);

export const MATERIAL_KINDS = [
  'essential_oil',
  'absolute',
  'concrete',
  'resinoid',
  'co2',
  'isolate',
  'aromachemical',
  'accord',
  'solvent',
  'tincture',
  'botanical',
  'butter',
  'other',
] as const;

export const MATERIAL_ORIGINS = ['natural', 'synthetic', 'nature_identical', 'blend'] as const;

export const materialKindSchema = z.enum(MATERIAL_KINDS);
export const materialOriginSchema = z.enum(MATERIAL_ORIGINS);

export const allergenProfileSchema = z.record(
  z.string().trim().min(1).max(80),
  z.number().min(0).max(100),
);

const NOTE_VALUES = new Set(['top', 'middle', 'base', 'modifier']);

function splitCsv(s?: string, max = 20): string[] | undefined {
  if (!s?.trim()) return undefined;
  const parts = s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, max);
  return parts.length ? parts : undefined;
}

function truthyFlag(value: unknown): boolean {
  return value === true || value === '1' || value === 'true';
}

function requireSolventIfDiluted(
  data: { stockConcentrationPct?: number; solvent?: string | null },
  ctx: z.RefinementCtx,
) {
  const conc = data.stockConcentrationPct ?? 100;
  if (conc < 100 && !data.solvent?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Solvent is required when stock concentration is below 100%',
      path: ['solvent'],
    });
  }
}

export const listMaterialsQuerySchema = z
  .object({
    q: z.string().trim().optional(),
    note: z.string().optional(),
    family: z.string().optional(),
    manufacturer: z.string().optional(),
    includePrivate: z.union([z.string(), z.boolean()]).optional(),
    limit: z.coerce.number().int().min(1).max(2000).default(100),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .transform((raw) => {
    const notes = splitCsv(raw.note, 4)?.filter((n): n is z.infer<typeof pyramidNoteFilterSchema> =>
      NOTE_VALUES.has(n),
    );
    return {
      q: raw.q,
      notes: notes?.length ? notes : undefined,
      families: splitCsv(raw.family),
      manufacturers: splitCsv(raw.manufacturer),
      includePrivate: truthyFlag(raw.includePrivate),
      limit: raw.limit,
      offset: raw.offset,
    };
  });

export const createMaterialBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    category: materialKindSchema,
    origin: materialOriginSchema,
    pyramidNote: pyramidNoteFilterSchema,
    stockConcentrationPct: z.coerce.number().gt(0).max(100).optional().default(100),
    costPerGram: z.coerce.number().min(0).optional().default(0),
    solvent: z.string().trim().max(80).optional(),
    casNumber: z.string().trim().max(32).optional(),
    olfactoryFamily: z.string().trim().max(80).optional(),
    manufacturer: z.string().trim().max(120).optional(),
    description: z.string().trim().max(2000).optional(),
    tenacityHours: z.coerce.number().min(0).max(10_000).optional(),
    allergenProfile: allergenProfileSchema.optional(),
  })
  .superRefine(requireSolventIfDiluted);

export const updateMaterialBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    category: materialKindSchema.optional(),
    origin: materialOriginSchema.optional(),
    pyramidNote: pyramidNoteFilterSchema.optional(),
    stockConcentrationPct: z.coerce.number().gt(0).max(100).optional(),
    costPerGram: z.coerce.number().min(0).optional(),
    solvent: z.string().trim().max(80).nullable().optional(),
    casNumber: z.string().trim().max(32).nullable().optional(),
    olfactoryFamily: z.string().trim().max(80).nullable().optional(),
    manufacturer: z.string().trim().max(120).nullable().optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    tenacityHours: z.coerce.number().min(0).max(10_000).nullable().optional(),
    allergenProfile: allergenProfileSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (Object.values(data).every((value) => value === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one field is required',
      });
    }
    requireSolventIfDiluted(data, ctx);
  });

export const createSupplierPriceBodySchema = z.object({
  supplierId: z.string().uuid(),
  materialId: z.string().uuid(),
  pricePerGram: z.coerce.number().min(0),
  currency: z.string().trim().min(3).max(8).optional().default('USD'),
  sponsored: z.boolean().optional().default(false),
});

export type ListMaterialsQuery = z.infer<typeof listMaterialsQuerySchema>;
export type CreateMaterialBody = z.infer<typeof createMaterialBodySchema>;
export type UpdateMaterialBody = z.infer<typeof updateMaterialBodySchema>;
export type CreateSupplierPriceBody = z.infer<typeof createSupplierPriceBodySchema>;
export type MaterialKind = z.infer<typeof materialKindSchema>;
export type MaterialOrigin = z.infer<typeof materialOriginSchema>;
export type PyramidNote = z.infer<typeof pyramidNoteFilterSchema>;

export type CatalogIndexItem = {
  id: string;
  name: string;
  casNumber: string | null;
  category: string | null;
  origin: string | null;
  olfactoryFamily: string | null;
  pyramidNote: string | null;
  manufacturer: string | null;
  costPerGram: string | null;
  slug: string | null;
  imageUrl: string | null;
  searchText: string | null;
  isPrivate: boolean;
};

export type CatalogIndexFilter = {
  q?: string;
  notes?: string[];
  families?: string[];
  manufacturers?: string[];
};

export function filterCatalogIndex(
  items: CatalogIndexItem[],
  query: CatalogIndexFilter,
): CatalogIndexItem[] {
  const q = query.q?.trim().toLowerCase();
  return items.filter((item) => {
    if (q) {
      const hay = [
        item.name,
        item.casNumber,
        item.slug,
        item.searchText,
        item.manufacturer,
        item.category,
        item.origin,
        item.olfactoryFamily,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (query.notes?.length) {
      if (!item.pyramidNote || !query.notes.includes(item.pyramidNote)) return false;
    }
    if (query.families?.length) {
      if (!item.olfactoryFamily || !query.families.includes(item.olfactoryFamily)) return false;
    }
    if (query.manufacturers?.length) {
      if (!item.manufacturer || !query.manufacturers.includes(item.manufacturer)) return false;
    }
    return true;
  });
}
