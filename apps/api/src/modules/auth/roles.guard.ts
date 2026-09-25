import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@fc/shared';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { users } from '../../database/schema';
import { JwtPayload } from './auth.types';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const req = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const userId = req.user?.sub;
    if (!userId) throw new ForbiddenException('Admin access required');

    const [row] = await this.db.db
      .select({ role: users.role, status: users.status })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!row || row.status === 'disabled' || !roles.includes(row.role as UserRole)) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
