import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  createMaterialBodySchema,
  listMaterialsQuerySchema,
  CreateMaterialBody,
  ListMaterialsQuery,
} from '@fc/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CatalogService } from './catalog.service';

@Controller('catalog/materials')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(@Query(new ZodValidationPipe(listMaterialsQuerySchema)) query: ListMaterialsQuery) {
    return this.catalog.list(query);
  }

  @Post()
  create(@Body(new ZodValidationPipe(createMaterialBodySchema)) body: CreateMaterialBody) {
    return this.catalog.create(body);
  }
}
