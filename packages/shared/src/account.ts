import { z } from 'zod';
import { appLocaleSchema, appThemeSchema, selfAssignableRoleSchema } from './entitlements';

export const updateAccountBodySchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email().optional(),
    role: selfAssignableRoleSchema.optional(),
    locale: appLocaleSchema.optional(),
    theme: appThemeSchema.optional(),
    defaultBatchTargetGrams: z.coerce.number().min(0.001).max(1_000_000).optional(),
    defaultConcentrationPct: z.coerce.number().min(0.1).max(100).optional(),
    defaultIfraCategory: z.coerce.number().int().min(1).max(12).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'No fields to update' });

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

export const logoutAllBodySchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export type UpdateAccountBody = z.infer<typeof updateAccountBodySchema>;
export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;
