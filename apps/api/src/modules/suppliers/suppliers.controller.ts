import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { createSupplierPriceBodySchema, CreateSupplierPriceBody } from '@fc/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtPayload } from '../auth/auth.types';
import { RequiresFeature } from '../auth/roles.decorator';
import { SuppliersService } from './suppliers.service';

@Controller('suppliers')
@RequiresFeature('suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  list() {
    return this.suppliers.list();
  }

  @Post()
  create(@Body() body: { name: string; website?: string; notes?: string }) {
    return this.suppliers.create(body);
  }

  @Post('prices')
  createPrice(
    @Req() req: { user: JwtPayload },
    @Body(new ZodValidationPipe(createSupplierPriceBodySchema)) body: CreateSupplierPriceBody,
  ) {
    return this.suppliers.createPrice(req.user, body);
  }
}
