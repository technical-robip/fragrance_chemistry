import { z } from 'zod';

export const upsertInventoryBodySchema = z.object({
  materialId: z.string().uuid(),
  quantityGrams: z.coerce.number().min(0),
  location: z.string().trim().max(120).optional(),
  kind: z.enum(['material', 'consumable']).optional(),
  minQuantityGrams: z.coerce.number().min(0).optional(),
  expiresAt: z.string().date().optional().nullable(),
});

export const adjustInventoryBodySchema = z.object({
  deltaGrams: z.coerce.number(),
});

export const patchInventoryBodySchema = z
  .object({
    quantityGrams: z.coerce.number().min(0).optional(),
    location: z.string().trim().max(120).optional().nullable(),
    kind: z.enum(['material', 'consumable']).optional(),
    minQuantityGrams: z.coerce.number().min(0).optional(),
    expiresAt: z.string().date().optional().nullable(),
  })
  .refine(
    (body) =>
      body.quantityGrams !== undefined ||
      body.location !== undefined ||
      body.kind !== undefined ||
      body.minQuantityGrams !== undefined ||
      body.expiresAt !== undefined,
    { message: 'At least one field is required' },
  );

export type UpsertInventoryBody = z.infer<typeof upsertInventoryBodySchema>;
export type AdjustInventoryBody = z.infer<typeof adjustInventoryBodySchema>;
export type PatchInventoryBody = z.infer<typeof patchInventoryBodySchema>;
