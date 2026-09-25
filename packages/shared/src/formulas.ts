import { z } from 'zod';

export const pyramidNoteSchema = z.enum(['top', 'middle', 'base', 'modifier']);

export const formulaLineSchema = z.object({
  materialId: z.string().uuid(),
  percent: z.coerce.number().min(0).max(100),
  sortOrder: z.coerce.number().int().min(0).optional(),
  pyramidNote: pyramidNoteSchema.optional(),
  weighedGrams: z.coerce.number().min(0).optional(),
  targetGrams: z.coerce.number().min(0).optional(),
  childFormulaId: z.string().uuid().optional(),
  stockConcentrationPct: z.coerce.number().min(0.001).max(100).optional(),
  solvent: z.string().trim().max(80).optional(),
});

export const createFormulaBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(),
  batchTargetGrams: z.coerce.number().min(0.001).max(1_000_000).optional(),
  concentrationPct: z.coerce.number().min(0.1).max(100).optional(),
  status: z.enum(['draft', 'ready', 'archived']).optional(),
  isLibraryAccord: z.boolean().optional(),
  lines: z.array(formulaLineSchema).default([]),
});

export const updateFormulaBodySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  batchTargetGrams: z.coerce.number().min(0.001).max(1_000_000).optional(),
  concentrationPct: z.coerce.number().min(0.1).max(100).optional(),
  status: z.enum(['draft', 'ready', 'archived']).optional(),
});

export const replaceFormulaLinesBodySchema = z.object({
  lines: z.array(formulaLineSchema),
});

export type FormulaLine = z.infer<typeof formulaLineSchema>;
export type CreateFormulaBody = z.infer<typeof createFormulaBodySchema>;
export type UpdateFormulaBody = z.infer<typeof updateFormulaBodySchema>;
export type ReplaceFormulaLinesBody = z.infer<typeof replaceFormulaLinesBodySchema>;
