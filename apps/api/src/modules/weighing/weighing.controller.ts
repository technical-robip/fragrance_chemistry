import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtPayload } from '../auth/auth.types';
import { RequiresFeature } from '../auth/roles.decorator';
import { WeighingService } from './weighing.service';

const createSessionSchema = z.object({
  formulaId: z.string().uuid(),
});

@Controller('weighing')
@RequiresFeature('weighing')
export class WeighingController {
  constructor(private readonly weighing: WeighingService) {}

  @Get('sessions')
  list(@Req() req: { user: JwtPayload }) {
    return this.weighing.list(req.user);
  }

  @Post('sessions')
  create(
    @Req() req: { user: JwtPayload },
    @Body(new ZodValidationPipe(createSessionSchema)) body: { formulaId: string },
  ) {
    return this.weighing.create(req.user, body.formulaId);
  }
}
