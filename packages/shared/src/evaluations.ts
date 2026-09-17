import { z } from 'zod';

export const createEvaluationBodySchema = z.object({
  formulaId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  notes: z.string().trim().max(8000).optional(),
});

export type CreateEvaluationBody = z.infer<typeof createEvaluationBodySchema>;
