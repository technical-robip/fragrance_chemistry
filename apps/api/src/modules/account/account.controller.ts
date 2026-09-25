import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import {
  changePasswordBodySchema,
  ChangePasswordBody,
  updateAccountBodySchema,
  UpdateAccountBody,
} from '@fc/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtPayload } from '../auth/auth.types';
import { AccountService } from './account.service';

@Controller('account')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get()
  get(@Req() req: { user: JwtPayload }) {
    return this.account.get(req.user);
  }

  @Patch()
  update(
    @Req() req: { user: JwtPayload },
    @Body(new ZodValidationPipe(updateAccountBodySchema)) body: UpdateAccountBody,
  ) {
    return this.account.update(req.user, body);
  }

  @Post('password')
  changePassword(
    @Req() req: { user: JwtPayload },
    @Body(new ZodValidationPipe(changePasswordBodySchema)) body: ChangePasswordBody,
  ) {
    return this.account.changePassword(req.user, body);
  }

  @Post('logout-all')
  logoutAll(@Req() req: { user: JwtPayload }) {
    return this.account.logoutAll(req.user);
  }
}
