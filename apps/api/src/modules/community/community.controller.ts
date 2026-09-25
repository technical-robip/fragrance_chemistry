import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { createPostBodySchema, CreatePostBody } from '@fc/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtPayload } from '../auth/auth.types';
import { RequiresFeature } from '../auth/roles.decorator';
import { CommunityService } from './community.service';

@Controller('community')
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get('posts')
  feed() {
    return this.community.feed();
  }

  @Post('posts')
  @RequiresFeature('community_posts')
  create(
    @Req() req: { user: JwtPayload },
    @Body(new ZodValidationPipe(createPostBodySchema)) body: CreatePostBody,
  ) {
    return this.community.create(req.user, body);
  }

  @Get('perfumes')
  @RequiresFeature('encyclopedia')
  perfumes() {
    return this.community.listPerfumes();
  }

  @Get('perfumes/:id')
  @RequiresFeature('encyclopedia')
  perfume(@Param('id') id: string) {
    return this.community.getPerfume(id);
  }

  @Post('perfumes/:id/lab-brief')
  @RequiresFeature('encyclopedia')
  labBrief(@Req() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.community.generateLabBrief(req.user, id);
  }
}
