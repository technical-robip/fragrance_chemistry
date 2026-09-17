import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { createPostBodySchema, CreatePostBody } from '@fc/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtPayload } from '../auth/auth.types';
import { CommunityService } from './community.service';

@Controller('community')
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get('posts')
  feed() {
    return this.community.feed();
  }

  @Post('posts')
  create(
    @Req() req: { user: JwtPayload },
    @Body(new ZodValidationPipe(createPostBodySchema)) body: CreatePostBody,
  ) {
    return this.community.create(req.user, body);
  }

  @Get('perfumes')
  perfumes() {
    return this.community.listPerfumes();
  }

  @Get('perfumes/:id')
  perfume(@Param('id') id: string) {
    return this.community.getPerfume(id);
  }

  @Post('perfumes/:id/lab-brief')
  labBrief(@Req() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.community.generateLabBrief(req.user, id);
  }
}
