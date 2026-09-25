import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { LoginBody, RefreshBody, RegisterBody } from '@fc/shared';
import { getEnv } from '../../config/env';
import { DatabaseService } from '../../database/database.service';
import { users } from '../../database/schema';
import { RedisService } from '../../redis/redis.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { AuthSession, AuthUserDto, JwtPayload } from './auth.types';

type UserRow = typeof users.$inferSelect;

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async register(body: RegisterBody): Promise<AuthSession> {
    const existing = await this.db.db
      .select()
      .from(users)
      .where(eq(users.email, body.email))
      .limit(1);
    if (existing[0]) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await argon2.hash(body.password);
    const [created] = await this.db.db
      .insert(users)
      .values({
        email: body.email,
        displayName: body.displayName,
        passwordHash,
        role: 'enthusiast',
        plan: 'free',
        status: 'active',
      })
      .returning();
    if (!created) {
      throw new ConflictException('Could not create user');
    }
    await this.entitlements.provisionFreePlan(created.id);
    const [fresh] = await this.db.db.select().from(users).where(eq(users.id, created.id)).limit(1);
    return this.issueSession(fresh ?? created);
  }

  async login(body: LoginBody): Promise<AuthSession> {
    const [user] = await this.db.db
      .select()
      .from(users)
      .where(eq(users.email, body.email))
      .limit(1);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.status === 'disabled') {
      throw new UnauthorizedException('Account disabled');
    }
    const ok = await argon2.verify(user.passwordHash, body.password);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueSession(user);
  }

  async me(payload: JwtPayload): Promise<AuthUserDto> {
    const [user] = await this.db.db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.status === 'disabled') {
      throw new UnauthorizedException('Account disabled');
    }
    return this.toUserDto(user);
  }

  async refresh(body: RefreshBody): Promise<AuthSession> {
    let payload: JwtPayload & { jti?: string; typ?: string };
    try {
      payload = this.jwt.verify(body.refreshToken, { secret: getEnv().JWT_SECRET });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.typ !== 'refresh' || !payload.jti) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const key = this.redis.refreshKey(payload.sub, payload.jti);
    const stored = await this.redis.client.get(key);
    if (!stored) {
      throw new UnauthorizedException('Refresh token revoked or expired');
    }
    await this.redis.client.del(key);
    const [user] = await this.db.db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
    if (!user || user.status === 'disabled') {
      throw new UnauthorizedException('User not found');
    }
    return this.issueSession(user);
  }

  async logout(user: JwtPayload, refreshToken?: string): Promise<void> {
    if (!refreshToken) return;
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: getEnv().JWT_SECRET,
      }) as JwtPayload & {
        jti?: string;
        typ?: string;
      };
      if (payload.typ === 'refresh' && payload.jti && payload.sub === user.sub) {
        await this.redis.client.del(this.redis.refreshKey(payload.sub, payload.jti));
      }
    } catch {
      /* ignore invalid token on logout */
    }
  }

  async logoutAll(userId: string) {
    await this.redis.deleteRefreshTokensForUser(userId);
  }

  async toUserDto(user: UserRow): Promise<AuthUserDto> {
    const entitlements = await this.entitlements.resolve(user.id);
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      plan: entitlements.plan.slug,
      status: user.status,
      locale: user.locale,
      theme: user.theme,
      defaultBatchTargetGrams: Number(user.defaultBatchTargetGrams ?? 10),
      defaultConcentrationPct: Number(user.defaultConcentrationPct ?? 20),
      defaultIfraCategory: Number(user.defaultIfraCategory ?? 4),
      createdAt:
        user.createdAt instanceof Date ? user.createdAt.toISOString() : String(user.createdAt),
      entitlements,
    };
  }

  private async issueSession(user: UserRow): Promise<AuthSession> {
    const env = getEnv();
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const jti = randomUUID();
    const accessToken = await this.jwt.signAsync(
      { ...payload, typ: 'access' },
      { secret: env.JWT_SECRET, expiresIn: env.JWT_ACCESS_TTL as `${number}m` },
    );
    const refreshToken = await this.jwt.signAsync(
      { ...payload, typ: 'refresh', jti },
      { secret: env.JWT_SECRET, expiresIn: env.JWT_REFRESH_TTL as `${number}d` },
    );
    const ttlSeconds = parseRefreshTtlSeconds(env.JWT_REFRESH_TTL);
    await this.redis.client.set(this.redis.refreshKey(payload.sub, jti), '1', 'EX', ttlSeconds);
    return {
      accessToken,
      refreshToken,
      user: await this.toUserDto(user),
    };
  }
}

function parseRefreshTtlSeconds(raw: string): number {
  const m = /^(\d+)([smhd])$/.exec(raw.trim());
  if (!m) return 7 * 24 * 3600;
  const n = Number(m[1]);
  switch (m[2]) {
    case 's':
      return n;
    case 'm':
      return n * 60;
    case 'h':
      return n * 3600;
    default:
      return n * 86400;
  }
}

export { parseRefreshTtlSeconds };
