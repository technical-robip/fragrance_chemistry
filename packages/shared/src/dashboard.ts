import { z } from 'zod';

export const dashboardBriefingQuerySchema = z.object({
  formulaId: z.string().uuid(),
});

export type DashboardBriefingQuery = z.infer<typeof dashboardBriefingQuerySchema>;

export const juiceClassSchema = z.enum(['edt', 'edp', 'extrait']);
export type JuiceClass = z.infer<typeof juiceClassSchema>;

/** EDT &lt;15%, EDP 15–20%, Extrait ≥20% concentrate. */
export function juiceClassFromConcentration(concentrationPct: number): JuiceClass {
  if (concentrationPct < 15) return 'edt';
  if (concentrationPct < 20) return 'edp';
  return 'extrait';
}
