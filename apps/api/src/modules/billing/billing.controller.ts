import { Controller, Get, Req } from '@nestjs/common';
import { JwtPayload } from '../auth/auth.types';
import { EntitlementsService } from '../entitlements/entitlements.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly entitlements: EntitlementsService) {}

  @Get('status')
  async status(@Req() req: { user: JwtPayload }) {
    const entitlements = await this.entitlements.resolve(req.user.sub);
    return {
      enabled: false,
      plan: entitlements.plan.slug,
      planName: entitlements.plan.name,
      status: entitlements.subscription?.status ?? 'active',
      message: 'Billing integration stub — connect Stripe when ready.',
      entitlements,
    };
  }
}
