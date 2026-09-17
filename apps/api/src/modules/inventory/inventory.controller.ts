import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { upsertInventoryBodySchema, UpsertInventoryBody } from '@fc/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtPayload } from '../auth/auth.types';
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  list(@Req() req: { user: JwtPayload }) {
    return this.inventory.list(req.user);
  }

  @Post()
  upsert(
    @Req() req: { user: JwtPayload },
    @Body(new ZodValidationPipe(upsertInventoryBodySchema)) body: UpsertInventoryBody,
  ) {
    return this.inventory.upsert(req.user, body);
  }
}
