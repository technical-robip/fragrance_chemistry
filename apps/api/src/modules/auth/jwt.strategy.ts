import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { eq } from 'drizzle-orm';
import { getEnv } from '../../config/env';
import { DatabaseService } from '../../database/database.service';
import { users } from '../../database/schema';
import { JwtPayload } from './auth.types';

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
    return payload;
  }
}
