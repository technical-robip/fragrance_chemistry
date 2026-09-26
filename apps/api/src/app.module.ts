import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ClsModule } from 'nestjs-cls';
import { DatabaseModule } from './database/database.module';
import { TenantInterceptor } from './common/interceptors/tenant.interceptor';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { FeatureGuard } from './modules/auth/feature.guard';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { RolesGuard } from './modules/auth/roles.guard';
import { HealthModule } from './modules/health/health.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { FormulasModule } from './modules/formulas/formulas.module';
import { IfraModule } from './modules/ifra/ifra.module';
import { CostingModule } from './modules/costing/costing.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { CommunityModule } from './modules/community/community.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { EvaluationsModule } from './modules/evaluations/evaluations.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { BillingModule } from './modules/billing/billing.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EntitlementsModule } from './modules/entitlements/entitlements.module';
import { AccountModule } from './modules/account/account.module';
import { AdminModule } from './modules/admin/admin.module';
import { WeighingModule } from './modules/weighing/weighing.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ClsModule.forRoot({ global: true, middleware: { mount: true } }),
    DatabaseModule,
    RedisModule,
    EntitlementsModule,
    AuthModule,
    HealthModule,
    DashboardModule,
    CatalogModule,
    FormulasModule,
    IfraModule,
    CostingModule,
    InventoryModule,
    CommunityModule,
    SuppliersModule,
    EvaluationsModule,
    NotificationsModule,
    WeighingModule,
    JobsModule,
    BillingModule,
    AccountModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: FeatureGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
  ],
})
export class AppModule {}
