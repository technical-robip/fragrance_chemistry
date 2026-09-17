import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  loginBodySchema,
  refreshBodySchema,
  registerBodySchema,
  LoginBody,
  RefreshBody,
  RegisterBody,
} from '@fc/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Public } from './public.decorator';
import { JwtPayload } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body(new ZodValidationPipe(registerBodySchema)) body: RegisterBody) {
    return this.auth.register(body);
  }

  @Public()
  @Post('login')
  login(@Body(new ZodValidationPipe(loginBodySchema)) body: LoginBody) {
    return this.auth.login(body);
  }

  @Public()
  @Post('refresh')
  refresh(@Body(new ZodValidationPipe(refreshBodySchema)) body: RefreshBody) {
    return this.auth.refresh(body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(
    @Req() req: { user: JwtPayload; body?: { refreshToken?: string } },
    @Body() body: { refreshToken?: string },
  ) {
    return this.auth.logout(req.user, body.refreshToken);
  }
}
