import { z } from 'zod';

export const formulaLineSchema = z.object({
  materialId: z.string().uuid(),
  percent: z.coerce.number().min(0).max(100),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export const createFormulaBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(),
  lines: z.array(formulaLineSchema).min(1),
});

export const updateFormulaBodySchema = createFormulaBodySchema.partial();

export type FormulaLine = z.infer<typeof formulaLineSchema>;
export type CreateFormulaBody = z.infer<typeof createFormulaBodySchema>;
