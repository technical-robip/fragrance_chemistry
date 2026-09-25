import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { RolesGuard } from './roles.guard';

function ctx(user?: { sub: string }) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as any;
}

describe('RolesGuard', () => {
  it('allows when no roles are required', async () => {
    const guard = new RolesGuard({ getAllAndOverride: () => undefined } as any, {} as any);
    await expect(guard.canActivate(ctx({ sub: 'u1' }))).resolves.toBe(true);
  });

  it('rejects a perfumer on admin routes', async () => {
    const guard = new RolesGuard(
      { getAllAndOverride: () => ['admin'] } as any,
      {
        db: {
          select: () => ({
            from: () => ({
              where: () => ({
                limit: async () => [{ role: 'perfumer', status: 'active' }],
              }),
            }),
          }),
        },
      } as any,
    );
    await expect(guard.canActivate(ctx({ sub: 'u1' }))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
