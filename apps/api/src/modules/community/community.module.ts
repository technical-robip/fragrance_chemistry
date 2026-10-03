import { Module } from '@nestjs/common';
import { FormulasModule } from '../formulas/formulas.module';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';

@Module({
  imports: [FormulasModule],
  controllers: [CommunityController],
  providers: [CommunityService],
})
export class CommunityModule {}
