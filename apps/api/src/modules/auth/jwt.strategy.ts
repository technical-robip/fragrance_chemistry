import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { eq, sql } from 'drizzle-orm';
import { getEnv } from '../../config/env';
import { DatabaseService } from '../../database/database.service';
import { users } from '../../database/schema';
import { JwtPayload } from './auth.types';

function firstOrg(result: unknown) {
  const rows = Array.isArray(result)
    ? (result as Array<{ org?: string | null }>)
    : ((result as { rows?: Array<{ org?: string | null }> }).rows ?? []);
  return rows[0]?.org ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly db: DatabaseService) {
    const env = getEnv();
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.JWT_SECRET,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const [user] = await this.db.db
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);
    if (!user || user.status === 'disabled') {
      throw new UnauthorizedException();
    }
    const result = payload.org
      ? await this.db.db.execute(
          sql`SELECT core.resolve_org(${payload.sub}::uuid, ${payload.org}::uuid) AS org`,
        )
      : await this.db.db.execute(sql`SELECT core.personal_org_id(${payload.sub}::uuid) AS org`);
    const org = firstOrg(result);
    if (!org) throw new UnauthorizedException();
    return { sub: payload.sub, email: payload.email, org };
  }
}
