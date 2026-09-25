import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureKey } from '@fc/shared';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { JwtPayload } from './auth.types';
import { FEATURE_KEY } from './roles.decorator';

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const feature = this.reflector.getAllAndOverride<FeatureKey>(FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!feature) return true;

    const req = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    if (!req.user?.sub) return false;
    await this.entitlements.assertFeature(req.user.sub, feature);
    return true;
  }
}
