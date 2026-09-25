import { z } from 'zod';

export const costingEstimateQuerySchema = z.object({
  batchGrams: z.coerce.number().min(0.001).max(1_000_000).optional(),
  wastePct: z.coerce.number().min(0).max(100).optional(),
  marginPct: z.coerce.number().min(0).max(100).optional(),
  bottleMl: z.coerce.number().min(0.001).max(10_000).optional(),
  packagingCost: z.coerce.number().min(0).max(1_000_000).optional(),
});

export type CostingEstimateQuery = z.infer<typeof costingEstimateQuerySchema>;
