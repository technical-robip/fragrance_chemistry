import { z } from 'zod';
import {
  featureKeySchema,
  FEATURE_KEYS,
  planSlugSchema,
  QUOTA_KEYS,
  quotaKeySchema,
  quotaOverridesSchema,
  subscriptionStatusSchema,
  userRoleSchema,
  userStatusSchema,
} from './entitlements';

export const adminListUsersQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  role: userRoleSchema.optional(),
  plan: z.string().trim().max(40).optional(),
  status: userStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const adminUpdateUserBodySchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email().optional(),
    role: userRoleSchema.optional(),
    status: userStatusSchema.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'No fields to update' });

export const adminSetPasswordBodySchema = z.object({
  password: z.string().min(8).max(128),
});

export const adminAssignSubscriptionBodySchema = z.object({
  planId: z.string().uuid(),
  status: subscriptionStatusSchema.default('active'),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  quotaOverrides: quotaOverridesSchema,
  note: z.string().trim().max(500).nullable().optional(),
});

export const adminCreatePlanBodySchema = z.object({
  slug: planSlugSchema,
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(2000).nullable().optional(),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.coerce.number().int().min(0).max(10_000).optional().default(100),
});

export const adminUpdatePlanBodySchema = z
  .object({
    slug: planSlugSchema.optional(),
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.coerce.number().int().min(0).max(10_000).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'No fields to update' });

export const adminPutQuotasBodySchema = z.object({
  quotas: z.record(quotaKeySchema, z.number().int().min(0).nullable()),
});

export const adminPutFeaturesBodySchema = z.object({
  features: z.record(featureKeySchema, z.boolean()),
});

export type AdminListUsersQuery = z.infer<typeof adminListUsersQuerySchema>;
export type AdminUpdateUserBody = z.infer<typeof adminUpdateUserBodySchema>;
export type AdminSetPasswordBody = z.infer<typeof adminSetPasswordBodySchema>;
export type AdminAssignSubscriptionBody = z.infer<typeof adminAssignSubscriptionBodySchema>;
export type AdminCreatePlanBody = z.infer<typeof adminCreatePlanBodySchema>;
export type AdminUpdatePlanBody = z.infer<typeof adminUpdatePlanBodySchema>;
export type AdminPutQuotasBody = z.infer<typeof adminPutQuotasBodySchema>;
export type AdminPutFeaturesBody = z.infer<typeof adminPutFeaturesBodySchema>;
