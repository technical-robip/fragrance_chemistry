import { Controller, Get } from '@nestjs/common';

@Controller('billing')
export class BillingController {
  @Get('status')
  status() {
    return {
      enabled: false,
      plan: 'free',
      message: 'Billing integration stub — connect Stripe when ready.',
    };
  }
}
