import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { z } from 'zod';
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

  @Get('organizations')
  organizations(@Req() req: { user: JwtPayload }) {
    return this.account.organizations(req.user);
  }

  @Get('organization')
  organization(@Req() req: { user: JwtPayload }) {
    return this.account.organization(req.user);
  }

  @Patch('organization')
  rename(
    @Req() req: { user: JwtPayload },
    @Body(new ZodValidationPipe(z.object({ name: z.string().trim().min(1).max(120) })))
    body: { name: string },
  ) {
    return this.account.renameOrganization(req.user, body.name);
  }

  @Post('organization/invites')
  invite(@Req() req: { user: JwtPayload }) {
    return this.account.invite(req.user);
  }

  @Delete('organization/invites/:id')
  revoke(@Req() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.account.revokeInvite(req.user, id);
  }

  @Delete('organization/members/:userId')
  removeMember(@Req() req: { user: JwtPayload }, @Param('userId') userId: string) {
    return this.account.removeMember(req.user, userId);
  }

  @Post('organization/switch')
  switchOrg(
    @Req() req: { user: JwtPayload },
    @Body(new ZodValidationPipe(z.object({ orgId: z.string().uuid() })))
    body: { orgId: string },
  ) {
    return this.account.switchOrganization(req.user, body.orgId);
  }

  @Post('organization/invites/accept')
  accept(
    @Req() req: { user: JwtPayload },
    @Body(new ZodValidationPipe(z.object({ token: z.string().trim().min(8).max(200) })))
    body: { token: string },
  ) {
    return this.account.acceptInvite(req.user, body.token);
  }
}
