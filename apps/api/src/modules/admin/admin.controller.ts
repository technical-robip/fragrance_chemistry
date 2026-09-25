import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import {
  adminAssignSubscriptionBodySchema,
  AdminAssignSubscriptionBody,
  adminCreatePlanBodySchema,
  AdminCreatePlanBody,
  adminListUsersQuerySchema,
  AdminListUsersQuery,
  adminPutFeaturesBodySchema,
  AdminPutFeaturesBody,
  adminPutQuotasBodySchema,
  AdminPutQuotasBody,
  adminSetPasswordBodySchema,
  AdminSetPasswordBody,
  adminUpdatePlanBodySchema,
  AdminUpdatePlanBody,
  adminUpdateUserBodySchema,
  AdminUpdateUserBody,
} from '@fc/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtPayload } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { AdminService } from './admin.service';

@Controller('admin')
@Roles('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('users')
  listUsers(@Query(new ZodValidationPipe(adminListUsersQuerySchema)) query: AdminListUsersQuery) {
    return this.admin.listUsers(query);
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.admin.getUser(id);
  }

  @Patch('users/:id')
  updateUser(
    @Req() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminUpdateUserBodySchema)) body: AdminUpdateUserBody,
  ) {
    return this.admin.updateUser(req.user, id, body);
  }

  @Post('users/:id/password')
  setPassword(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminSetPasswordBodySchema)) body: AdminSetPasswordBody,
  ) {
    return this.admin.setPassword(id, body);
  }

  @Post('users/:id/logout-all')
  logoutAll(@Param('id') id: string) {
    return this.admin.logoutAll(id);
  }

  @Post('users/:id/subscription')
  assignSubscription(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminAssignSubscriptionBodySchema))
    body: AdminAssignSubscriptionBody,
  ) {
    return this.admin.assignSubscription(id, body);
  }

  @Get('plans')
  listPlans() {
    return this.admin.listPlans();
  }

  @Post('plans')
  createPlan(@Body(new ZodValidationPipe(adminCreatePlanBodySchema)) body: AdminCreatePlanBody) {
    return this.admin.createPlan(body);
  }

  @Get('plans/:id')
  getPlan(@Param('id') id: string) {
    return this.admin.getPlan(id);
  }

  @Patch('plans/:id')
  updatePlan(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminUpdatePlanBodySchema)) body: AdminUpdatePlanBody,
  ) {
    return this.admin.updatePlan(id, body);
  }

  @Put('plans/:id/quotas')
  putQuotas(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminPutQuotasBodySchema)) body: AdminPutQuotasBody,
  ) {
    return this.admin.putQuotas(id, body);
  }

  @Put('plans/:id/features')
  putFeatures(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminPutFeaturesBodySchema)) body: AdminPutFeaturesBody,
  ) {
    return this.admin.putFeatures(id, body);
  }
}
