import { SetMetadata } from '@nestjs/common';
import { FeatureKey, UserRole } from '@fc/shared';

export const ROLES_KEY = 'roles';
export const FEATURE_KEY = 'requiredFeature';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
export const RequiresFeature = (feature: FeatureKey) => SetMetadata(FEATURE_KEY, feature);
