import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { getEnv } from '../../config/env';
import { FormulasModule } from '../formulas/formulas.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { OpenFormulasController } from './open-formulas.controller';
import { OpenFormulasService } from './open-formulas.service';

@Module({
  imports: [
    FormulasModule,
    OrganizationsModule,
    JwtModule.register({ secret: getEnv().JWT_SECRET }),
  ],
  controllers: [OpenFormulasController],
  providers: [OpenFormulasService],
})
export class OpenFormulasModule {}
