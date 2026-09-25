import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import {
  createMaterialBodySchema,
  listMaterialsQuerySchema,
  updateMaterialBodySchema,
  CreateMaterialBody,
  ListMaterialsQuery,
  UpdateMaterialBody,
} from '@fc/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtPayload } from '../auth/auth.types';
import { RequiresFeature } from '../auth/roles.decorator';
import { CatalogService } from './catalog.service';

/** Private materials are created via POST; list can include the caller's own rows. */
@Controller('catalog/materials')
@RequiresFeature('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(
    @Req() req: { user: JwtPayload },
    @Query(new ZodValidationPipe(listMaterialsQuerySchema)) query: ListMaterialsQuery,
  ) {
    return this.catalog.list(req.user, query);
  }

  @Get(':idOrSlug')
  get(@Req() req: { user: JwtPayload }, @Param('idOrSlug') idOrSlug: string) {
    return this.catalog.getByIdOrSlug(req.user, idOrSlug);
  }

  @Post()
  create(
    @Req() req: { user: JwtPayload },
    @Body(new ZodValidationPipe(createMaterialBodySchema)) body: CreateMaterialBody,
  ) {
    return this.catalog.create(req.user, body);
  }

  @Patch(':id')
  update(
    @Req() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateMaterialBodySchema)) body: UpdateMaterialBody,
  ) {
    return this.catalog.update(req.user, id, body);
  }

  @Delete(':id')
  remove(@Req() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.catalog.remove(req.user, id);
  }
}
