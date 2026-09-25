import { Controller, Get, Query, Req } from '@nestjs/common';
import { dashboardBriefingQuerySchema, DashboardBriefingQuery } from '@fc/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtPayload } from '../auth/auth.types';
import { RequiresFeature } from '../auth/roles.decorator';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@RequiresFeature('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('stats')
  stats(@Req() req: { user: JwtPayload }) {
    return this.dashboard.stats(req.user);
  }

  @Get('briefing')
  briefing(
    @Req() req: { user: JwtPayload },
    @Query(new ZodValidationPipe(dashboardBriefingQuerySchema)) query: DashboardBriefingQuery,
  ) {
    return this.dashboard.briefing(req.user, query.formulaId);
  }
}
