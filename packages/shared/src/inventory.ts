import { z } from 'zod';

export const upsertInventoryBodySchema = z.object({
  materialId: z.string().uuid(),
  quantityGrams: z.coerce.number().min(0),
  location: z.string().trim().max(120).optional(),
});

export type UpsertInventoryBody = z.infer<typeof upsertInventoryBodySchema>;
