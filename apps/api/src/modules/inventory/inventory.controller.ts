import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import {
  adjustInventoryBodySchema,
  AdjustInventoryBody,
  patchInventoryBodySchema,
  PatchInventoryBody,
  upsertInventoryBodySchema,
  UpsertInventoryBody,
} from '@fc/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtPayload } from '../auth/auth.types';
import { RequiresFeature } from '../auth/roles.decorator';
import { InventoryService } from './inventory.service';

@Controller('inventory')
@RequiresFeature('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  list(@Req() req: { user: JwtPayload }) {
    return this.inventory.list(req.user);
  }

  @Get(':id/events')
  events(@Req() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.inventory.listEvents(req.user, id);
  }

  @Post()
  upsert(
    @Req() req: { user: JwtPayload },
    @Body(new ZodValidationPipe(upsertInventoryBodySchema)) body: UpsertInventoryBody,
  ) {
    return this.inventory.upsert(req.user, body);
  }

  @Patch(':id/adjust')
  adjust(
    @Req() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adjustInventoryBodySchema)) body: AdjustInventoryBody,
  ) {
    return this.inventory.adjust(req.user, id, body);
  }

  @Patch(':id')
  patch(
    @Req() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body(new ZodValidationPipe(patchInventoryBodySchema)) body: PatchInventoryBody,
  ) {
    return this.inventory.patch(req.user, id, body);
  }

  @Delete(':id')
  remove(@Req() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.inventory.remove(req.user, id);
  }
}
