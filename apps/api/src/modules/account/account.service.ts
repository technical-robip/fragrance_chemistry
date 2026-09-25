import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { and, eq, ne } from 'drizzle-orm';
import { ChangePasswordBody, UpdateAccountBody } from '@fc/shared';
import { DatabaseService } from '../../database/database.service';
import { users } from '../../database/schema';
import { AuthService } from '../auth/auth.service';
import { JwtPayload } from '../auth/auth.types';
import { DashboardService } from '../dashboard/dashboard.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

@Injectable()
export class AccountService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auth: AuthService,
    private readonly entitlements: EntitlementsService,
    private readonly dashboard: DashboardService,
  ) {}

  async get(user: JwtPayload) {
    const profile = await this.auth.me(user);
    const stats = await this.dashboard.stats(user);
    return {
      user: profile,
      entitlements: profile.entitlements,
      lab: {
        formulaCount: stats.formulaCount,
        evaluationCount: stats.evaluationCount,
        lowStockItems: stats.lowStockItems,
        weighingSessionCount: stats.weighingSessionCount,
        catalogSize: stats.catalogSize,
      },
      billing: {
        enabled: false,
        plan: profile.plan,
        planName: profile.entitlements.plan.name,
        status: profile.entitlements.subscription?.status ?? 'active',
        message: 'Billing integration stub — connect Stripe when ready.',
      },
    };
  }

  async update(user: JwtPayload, body: UpdateAccountBody) {
    const [current] = await this.db.db.select().from(users).where(eq(users.id, user.sub)).limit(1);
    if (!current) throw new NotFoundException('User not found');

    if (body.email && body.email !== current.email) {
      const [taken] = await this.db.db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, body.email), ne(users.id, user.sub)))
        .limit(1);
      if (taken) throw new ConflictException('Email already registered');
    }

    const selfRole =
      current.role === 'enthusiast' || current.role === 'perfumer' ? body.role : undefined;

    const [updated] = await this.db.db
      .update(users)
      .set({
        ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(selfRole !== undefined ? { role: selfRole } : {}),
        ...(body.locale !== undefined ? { locale: body.locale } : {}),
        ...(body.theme !== undefined ? { theme: body.theme } : {}),
        ...(body.defaultBatchTargetGrams !== undefined
          ? { defaultBatchTargetGrams: body.defaultBatchTargetGrams.toString() }
          : {}),
        ...(body.defaultConcentrationPct !== undefined
          ? { defaultConcentrationPct: body.defaultConcentrationPct.toString() }
          : {}),
        ...(body.defaultIfraCategory !== undefined
          ? { defaultIfraCategory: body.defaultIfraCategory }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.sub))
      .returning();
    if (!updated) throw new NotFoundException('User not found');
    return this.auth.toUserDto(updated);
  }

  async changePassword(user: JwtPayload, body: ChangePasswordBody) {
    const [current] = await this.db.db.select().from(users).where(eq(users.id, user.sub)).limit(1);
    if (!current) throw new NotFoundException('User not found');
    const ok = await argon2.verify(current.passwordHash, body.currentPassword);
    if (!ok) throw new UnauthorizedException('Current password is incorrect');
    const passwordHash = await argon2.hash(body.newPassword);
    await this.db.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, user.sub));
    await this.auth.logoutAll(user.sub);
  }

  async logoutAll(user: JwtPayload) {
    await this.auth.logoutAll(user.sub);
  }

  resolveEntitlements(userId: string) {
    return this.entitlements.resolve(userId);
  }
}
