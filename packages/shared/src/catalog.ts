import { z } from 'zod';

export const listMaterialsQuerySchema = z.object({
  q: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createMaterialBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  casNumber: z.string().trim().max(32).optional(),
  category: z.string().trim().max(80).optional(),
  description: z.string().trim().max(2000).optional(),
  costPerGram: z.coerce.number().min(0).optional(),
});

export type ListMaterialsQuery = z.infer<typeof listMaterialsQuerySchema>;
export type CreateMaterialBody = z.infer<typeof createMaterialBodySchema>;
