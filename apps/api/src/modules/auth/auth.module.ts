import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { getEnv } from '../../config/env';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FeatureGuard } from './feature.guard';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: getEnv().JWT_SECRET,
    }),
    EntitlementsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RolesGuard, FeatureGuard],
  exports: [AuthService, RolesGuard, FeatureGuard],
})
export class AuthModule {}
