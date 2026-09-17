import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { LoginBody, RefreshBody, RegisterBody } from '@fc/shared';
import { getEnv } from '../../config/env';
import { DatabaseService } from '../../database/database.service';
import { users } from '../../database/schema';
import { RedisService } from '../../redis/redis.service';
import { AuthTokens, JwtPayload } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
  ) {}

  async register(body: RegisterBody): Promise<AuthTokens> {
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
      })
      .returning();
    if (!created) {
      throw new ConflictException('Could not create user');
    }
    return this.issueTokens({ sub: created.id, email: created.email });
  }

  async login(body: LoginBody): Promise<AuthTokens> {
    const [user] = await this.db.db
      .select()
      .from(users)
      .where(eq(users.email, body.email))
      .limit(1);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await argon2.verify(user.passwordHash, body.password);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueTokens({ sub: user.id, email: user.email });
  }

  async refresh(body: RefreshBody): Promise<AuthTokens> {
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
    return this.issueTokens({ sub: payload.sub, email: payload.email });
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

  private async issueTokens(payload: JwtPayload): Promise<AuthTokens> {
    const env = getEnv();
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
    return { accessToken, refreshToken };
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
