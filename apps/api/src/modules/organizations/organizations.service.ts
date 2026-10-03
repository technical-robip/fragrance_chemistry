import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import {
  organizationInvites,
  organizationMembers,
  organizations,
  users,
} from '../../database/schema';
import { decodeMasterKey, generateDek, wrapDek } from '../../crypto/formula-crypto';
import { getEnv } from '../../config/env';
import { activeOrg, type JwtPayload } from '../auth/auth.types';

const INVITE_DAYS = 7;

export type OrgProfile = {
  id: string;
  name: string;
  role: 'owner' | 'member';
};

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: T[] }).rows;
  return rows ?? [];
}

@Injectable()
export class OrganizationsService {
  constructor(private readonly db: DatabaseService) {}

  async provisionPersonal(userId: string, displayName: string) {
    const master = decodeMasterKey(getEnv().FORMULA_MASTER_KEY);
    const wrapped = wrapDek(generateDek(), master, userId);
    const name = `${displayName}'s lab`;
    await this.db.db.execute(sql`
      SELECT core.provision_personal_organization(
        ${userId}::uuid,
        ${name},
        decode(${wrapped.secret.toString('hex')}, 'hex'),
        decode(${wrapped.nonce.toString('hex')}, 'hex')
      )
    `);
    return userId;
  }

  async personalOrgId(userId: string) {
    const result = await this.db.db.execute(
      sql`SELECT core.personal_org_id(${userId}::uuid) AS org`,
    );
    const org = rowsOf<{ org: string | null }>(result)[0]?.org;
    if (!org) throw new NotFoundException('Laboratory missing');
    return org;
  }

  async profile(userId: string, orgId: string): Promise<OrgProfile> {
    const result = await this.db.db.execute(
      sql`SELECT id, name, role FROM core.org_profile(${userId}::uuid, ${orgId}::uuid)`,
    );
    const row = rowsOf<{ id: string; name: string; role: string }>(result)[0];
    if (!row) throw new ForbiddenException('You are not a member of this laboratory');
    return { id: row.id, name: row.name, role: row.role === 'owner' ? 'owner' : 'member' };
  }

  async listFor(user: JwtPayload) {
    const db = this.db.client();
    const memberships = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        role: organizationMembers.role,
        isPersonal: organizations.isPersonal,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizations.id, organizationMembers.orgId))
      .where(eq(organizationMembers.userId, user.sub));
    const active = activeOrg(user);
    return memberships.map((row) => ({
      id: row.id,
      name: row.name,
      role: row.role === 'owner' ? ('owner' as const) : ('member' as const),
      isPersonal: row.isPersonal,
      active: row.id === active,
    }));
  }

  async current(user: JwtPayload) {
    const orgId = activeOrg(user);
    const profile = await this.profile(user.sub, orgId);
    const db = this.db.client();
    const members = await db
      .select({
        userId: organizationMembers.userId,
        role: organizationMembers.role,
        displayName: users.displayName,
        email: users.email,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(users.id, organizationMembers.userId))
      .where(eq(organizationMembers.orgId, orgId));
    const invites =
      profile.role === 'owner'
        ? await db
            .select({
              id: organizationInvites.id,
              token: organizationInvites.token,
              expiresAt: organizationInvites.expiresAt,
            })
            .from(organizationInvites)
            .where(
              and(
                eq(organizationInvites.orgId, orgId),
                sql`${organizationInvites.acceptedAt} IS NULL`,
              ),
            )
        : [];
    return {
      ...profile,
      members: members.map((member) => ({
        userId: member.userId,
        role: member.role === 'owner' ? ('owner' as const) : ('member' as const),
        displayName: member.displayName,
        email: profile.role === 'owner' ? member.email : null,
      })),
      invites: invites.map((invite) => ({
        id: invite.id,
        token: invite.token,
        expiresAt:
          invite.expiresAt instanceof Date
            ? invite.expiresAt.toISOString()
            : String(invite.expiresAt),
      })),
    };
  }

  async rename(user: JwtPayload, name: string) {
    const orgId = activeOrg(user);
    const profile = await this.profile(user.sub, orgId);
    if (profile.role !== 'owner')
      throw new ForbiddenException('Only the owner can rename the laboratory');
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('Name is required');
    const [row] = await this.db
      .client()
      .update(organizations)
      .set({ name: trimmed, updatedAt: new Date() })
      .where(eq(organizations.id, orgId))
      .returning();
    if (!row) throw new NotFoundException('Laboratory not found');
    return { id: row.id, name: row.name };
  }

  async createInvite(user: JwtPayload) {
    const orgId = activeOrg(user);
    const profile = await this.profile(user.sub, orgId);
    if (profile.role !== 'owner') throw new ForbiddenException('Only the owner can invite');
    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000);
    const [row] = await this.db
      .client()
      .insert(organizationInvites)
      .values({
        id: randomUUID(),
        orgId,
        token,
        createdBy: user.sub,
        expiresAt,
      })
      .returning();
    if (!row) throw new BadRequestException('Could not create invite');
    return {
      id: row.id,
      token: row.token,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async revokeInvite(user: JwtPayload, inviteId: string) {
    const orgId = activeOrg(user);
    const profile = await this.profile(user.sub, orgId);
    if (profile.role !== 'owner') throw new ForbiddenException('Only the owner can revoke invites');
    const [row] = await this.db
      .client()
      .delete(organizationInvites)
      .where(and(eq(organizationInvites.id, inviteId), eq(organizationInvites.orgId, orgId)))
      .returning();
    if (!row) throw new NotFoundException('Invite not found');
    return { id: row.id, revoked: true };
  }

  async removeMember(user: JwtPayload, memberId: string) {
    const orgId = activeOrg(user);
    const profile = await this.profile(user.sub, orgId);
    if (profile.role !== 'owner') throw new ForbiddenException('Only the owner can remove members');
    if (memberId === user.sub) throw new BadRequestException('The owner cannot leave this way');
    const [row] = await this.db
      .client()
      .delete(organizationMembers)
      .where(and(eq(organizationMembers.orgId, orgId), eq(organizationMembers.userId, memberId)))
      .returning();
    if (!row) throw new NotFoundException('Member not found');
    return { userId: memberId, removed: true };
  }

  async acceptInvite(userId: string, token: string) {
    try {
      const result = await this.db.db.execute(
        sql`SELECT core.accept_organization_invite(${userId}::uuid, ${token}) AS org`,
      );
      const org = rowsOf<{ org: string }>(result)[0]?.org;
      if (!org) throw new BadRequestException('This invite is no longer valid');
      return org;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('invite_invalid')) {
        throw new BadRequestException('This invite is no longer valid');
      }
      throw error;
    }
  }
}
