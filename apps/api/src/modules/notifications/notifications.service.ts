import { Injectable, NotFoundException } from '@nestjs/common';
import {
  dueEvaluationCheckpoints,
  isDayOne,
  isEvaluationCheckpointKey,
  startedAtForCheckpoint,
  type DueCheckpointAction,
  type NotificationInbox,
  type NotificationInboxItem,
  type NotificationPayload,
  type NotificationPreferences,
  type NotificationStatus,
  type SimulateNotificationBody,
} from '@fc/shared';
import { and, eq, sql } from 'drizzle-orm';
import { ClsService } from 'nestjs-cls';
import { DatabaseService } from '../../database/database.service';
import {
  evaluations,
  formulaNotificationMutes,
  formulas,
  macerationClocks,
  notifications,
  userNotificationPreferences,
} from '../../database/schema';
import type { NotificationDeliveryMessage } from './channels/channel';
import { InAppChannel } from './channels/in-app.channel';
import { PushChannel } from './channels/push.channel';
import { ResendEmailChannel } from './channels/resend-email.channel';

type NotificationRow = typeof notifications.$inferSelect;

const DEFAULT_PREFERENCES: NotificationPreferences = {
  evaluationEnabled: true,
  emailEnabled: false,
};

function asStatus(value: string): NotificationStatus | null {
  if (value === 'open' || value === 'dismissed' || value === 'resolved') return value;
  return null;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly cls: ClsService,
    private readonly inApp: InAppChannel,
    private readonly email: ResendEmailChannel,
    private readonly push: PushChannel,
  ) {}

  async onEvaluationSaved(
    ownerId: string,
    formulaId: string,
    macerationDay: number | null | undefined,
  ) {
    if (isDayOne(macerationDay)) await this.ensureClock(ownerId, formulaId);
    await this.syncUser(ownerId);
  }

  async syncUser(ownerId: string, now = new Date()): Promise<NotificationInbox> {
    const prefs = await this.getPreferences(ownerId);
    const db = this.db.client();
    const clocks = (
      await db.select().from(macerationClocks).where(eq(macerationClocks.ownerId, ownerId))
    ).filter((row) => row.ownerId === ownerId);
    const muteRows = (
      await db
        .select()
        .from(formulaNotificationMutes)
        .where(eq(formulaNotificationMutes.ownerId, ownerId))
    ).filter((row) => row.ownerId === ownerId);
    const muted = new Set(muteRows.map((row) => row.formulaId));
    const formulaIds = new Set(clocks.map((row) => row.formulaId));
    const sittingRows = (
      await db.select().from(evaluations).where(eq(evaluations.ownerId, ownerId))
    ).filter((row) => row.ownerId === ownerId && formulaIds.has(row.formulaId));
    const existing = (
      await db.select().from(notifications).where(eq(notifications.ownerId, ownerId))
    ).filter((row) => row.ownerId === ownerId);
    const formulaRows = (
      await db.select().from(formulas).where(eq(formulas.ownerId, ownerId))
    ).filter((row) => row.ownerId === ownerId && formulaIds.has(row.id));
    const names = new Map(formulaRows.map((row) => [row.id, row.name]));

    for (const clock of clocks) {
      const actions = dueEvaluationCheckpoints({
        formulaId: clock.formulaId,
        startedAt: clock.startedAt,
        now,
        sittings: sittingRows
          .filter((row) => row.formulaId === clock.formulaId)
          .map((row) => ({
            formulaId: row.formulaId,
            macerationDay: row.macerationDay,
            notes: row.notes,
            t0Notes: row.t0Notes,
            t30mNotes: row.t30mNotes,
            t4hNotes: row.t4hNotes,
            t24hNotes: row.t24hNotes,
          })),
        evaluationEnabled: prefs.evaluationEnabled,
        formulaMuted: muted.has(clock.formulaId),
        recorded: existing.flatMap((row) => {
          if (row.formulaId !== clock.formulaId || !row.checkpointKey) return [];
          const status = asStatus(row.status);
          if (!status) return [];
          return [{ checkpointKey: row.checkpointKey, status }];
        }),
      });
      for (const action of actions) {
        if (action.action === 'resolve') {
          await this.resolveRow(ownerId, action, now, existing);
        } else {
          await this.openRow(ownerId, action, now, existing);
        }
      }
    }

    return this.inboxFrom(existing, prefs.evaluationEnabled, muted, names);
  }

  async dismiss(ownerId: string, id: string) {
    const row = await this.findOwn(ownerId, id);
    if (!row) throw new NotFoundException('Notification not found');
    if (row.status !== 'open') {
      return { id: row.id, status: asStatus(row.status) ?? 'open', unread: row.readAt == null };
    }
    const dismissedAt = new Date();
    await this.db
      .client()
      .update(notifications)
      .set({ status: 'dismissed', dismissedAt })
      .where(and(eq(notifications.ownerId, ownerId), eq(notifications.id, row.id)));
    return { id: row.id, status: 'dismissed' as const, unread: false };
  }

  async markRead(ownerId: string, id: string) {
    const row = await this.findOwn(ownerId, id);
    if (!row) throw new NotFoundException('Notification not found');
    if (row.readAt) {
      return { id: row.id, status: asStatus(row.status) ?? 'open', unread: false };
    }
    const readAt = new Date();
    await this.db
      .client()
      .update(notifications)
      .set({ readAt })
      .where(and(eq(notifications.ownerId, ownerId), eq(notifications.id, row.id)));
    return { id: row.id, status: asStatus(row.status) ?? 'open', unread: false };
  }

  async getPreferences(ownerId: string): Promise<NotificationPreferences> {
    const [row] = await this.db
      .client()
      .select()
      .from(userNotificationPreferences)
      .where(eq(userNotificationPreferences.userId, ownerId))
      .limit(1);
    if (!row || row.userId !== ownerId) return { ...DEFAULT_PREFERENCES };
    return {
      evaluationEnabled: row.evaluationEnabled,
      emailEnabled: row.emailEnabled,
    };
  }

  async updatePreferences(
    ownerId: string,
    patch: { evaluationEnabled?: boolean; emailEnabled?: boolean },
  ): Promise<NotificationPreferences> {
    const current = await this.getPreferences(ownerId);
    const next: NotificationPreferences = {
      evaluationEnabled: patch.evaluationEnabled ?? current.evaluationEnabled,
      emailEnabled: patch.emailEnabled ?? current.emailEnabled,
    };
    await this.db
      .client()
      .insert(userNotificationPreferences)
      .values({
        userId: ownerId,
        evaluationEnabled: next.evaluationEnabled,
        emailEnabled: next.emailEnabled,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userNotificationPreferences.userId,
        set: {
          evaluationEnabled: next.evaluationEnabled,
          emailEnabled: next.emailEnabled,
          updatedAt: new Date(),
        },
      });
    return next;
  }

  async getFormulaMute(ownerId: string, formulaId: string) {
    await this.requireFormula(ownerId, formulaId);
    const rows = await this.db
      .client()
      .select()
      .from(formulaNotificationMutes)
      .where(
        and(
          eq(formulaNotificationMutes.ownerId, ownerId),
          eq(formulaNotificationMutes.formulaId, formulaId),
        ),
      );
    const muted = rows.some((row) => row.ownerId === ownerId && row.formulaId === formulaId);
    return { formulaId, muted };
  }

  async setFormulaMute(ownerId: string, formulaId: string, muted: boolean) {
    await this.requireFormula(ownerId, formulaId);
    const db = this.db.client();
    if (muted) {
      await db
        .insert(formulaNotificationMutes)
        .values({ ownerId, formulaId, mutedAt: new Date() })
        .onConflictDoNothing({
          target: [formulaNotificationMutes.ownerId, formulaNotificationMutes.formulaId],
        });
    } else {
      await db
        .delete(formulaNotificationMutes)
        .where(
          and(
            eq(formulaNotificationMutes.ownerId, ownerId),
            eq(formulaNotificationMutes.formulaId, formulaId),
          ),
        );
    }
    await this.syncUser(ownerId);
    return { formulaId, muted };
  }

  async simulate(ownerId: string, body: SimulateNotificationBody, now = new Date()) {
    await this.requireFormula(ownerId, body.formulaId);
    const clocks = await this.db
      .client()
      .select()
      .from(macerationClocks)
      .where(eq(macerationClocks.ownerId, ownerId));
    const clock = clocks.find((row) => row.ownerId === ownerId && row.formulaId === body.formulaId);
    if (!clock) throw new NotFoundException('Maceration has not started');
    const startedAt = startedAtForCheckpoint(body.atCheckpoint, now);
    await this.db
      .client()
      .update(macerationClocks)
      .set({ startedAt })
      .where(
        and(eq(macerationClocks.ownerId, ownerId), eq(macerationClocks.formulaId, body.formulaId)),
      );
    return this.syncUser(ownerId, now);
  }

  async sweepActiveClocks(now = new Date()): Promise<{ users: number }> {
    const owners = await this.clockOwnerIds();
    for (const ownerId of owners) {
      await this.cls.run(async () => {
        await this.db.runWithTenant(ownerId, () => this.syncUser(ownerId, now));
      });
    }
    return { users: owners.length };
  }

  private async ensureClock(ownerId: string, formulaId: string) {
    await this.db
      .client()
      .insert(macerationClocks)
      .values({ ownerId, formulaId, startedAt: new Date() })
      .onConflictDoNothing({
        target: [macerationClocks.ownerId, macerationClocks.formulaId],
      });
  }

  private async resolveRow(
    ownerId: string,
    action: Extract<DueCheckpointAction, { action: 'resolve' }>,
    now: Date,
    existing: NotificationRow[],
  ) {
    await this.db
      .client()
      .update(notifications)
      .set({ status: 'resolved', resolvedAt: now })
      .where(
        and(eq(notifications.ownerId, ownerId), eq(notifications.dedupeKey, action.dedupeKey)),
      );
    const row = existing.find((item) => item.dedupeKey === action.dedupeKey);
    if (row) {
      row.status = 'resolved';
      row.resolvedAt = now;
    }
  }

  private async openRow(
    ownerId: string,
    action: Extract<DueCheckpointAction, { action: 'open' }>,
    now: Date,
    existing: NotificationRow[],
  ) {
    const payload: NotificationPayload = {
      kind: action.kind,
      checkpointKey: action.checkpointKey,
      formulaId: action.formulaId,
      deepLink: action.deepLink,
    };
    const inserted = await this.db
      .client()
      .insert(notifications)
      .values({
        ownerId,
        formulaId: action.formulaId,
        kind: action.kind,
        dedupeKey: action.dedupeKey,
        checkpointKey: action.checkpointKey,
        status: 'open',
        payload,
        createdAt: now,
      })
      .onConflictDoNothing({
        target: [notifications.ownerId, notifications.dedupeKey],
      })
      .returning();
    const created = inserted[0];
    if (!created) return;
    existing.push(created);
    await this.dispatch({
      ownerId,
      dedupeKey: action.dedupeKey,
      kind: 'evaluation.checkpoint',
      payload,
    });
  }

  private async dispatch(message: NotificationDeliveryMessage) {
    await this.inApp.deliver(message);
    await this.safeDeliver(this.email, message);
    await this.safeDeliver(this.push, message);
  }

  private async safeDeliver(
    channel: { deliver(message: NotificationDeliveryMessage): Promise<unknown> },
    message: NotificationDeliveryMessage,
  ) {
    try {
      await channel.deliver(message);
    } catch {
      // An outbound channel must not roll back the in-app row.
    }
  }

  private inboxFrom(
    rows: NotificationRow[],
    enabled: boolean,
    muted: Set<string>,
    names: Map<string, string>,
  ): NotificationInbox {
    if (!enabled) return { unreadCount: 0, items: [] };
    const items = rows
      .flatMap((row) => {
        if (row.status !== 'open' || !row.formulaId || muted.has(row.formulaId)) return [];
        if (!row.checkpointKey || !isEvaluationCheckpointKey(row.checkpointKey)) return [];
        if (row.kind !== 'evaluation.checkpoint') return [];
        const item: NotificationInboxItem = {
          id: row.id,
          kind: 'evaluation.checkpoint',
          checkpointKey: row.checkpointKey,
          formulaId: row.formulaId,
          formulaName: names.get(row.formulaId) ?? row.formulaId,
          status: 'open',
          unread: row.readAt == null,
          deepLink: row.payload?.deepLink ?? {
            path: '/evaluation',
            query: { formula: row.formulaId, day: '1' },
          },
          createdAt: iso(row.createdAt),
        };
        return [item];
      })
      .sort((a, b) => {
        if (a.createdAt === b.createdAt) return 0;
        return a.createdAt < b.createdAt ? 1 : -1;
      });
    return { unreadCount: items.filter((item) => item.unread).length, items };
  }

  private async findOwn(ownerId: string, id: string) {
    const rows = await this.db
      .client()
      .select()
      .from(notifications)
      .where(and(eq(notifications.ownerId, ownerId), eq(notifications.id, id)));
    return rows.find((row) => row.ownerId === ownerId && row.id === id) ?? null;
  }

  private async requireFormula(ownerId: string, formulaId: string) {
    const rows = await this.db
      .client()
      .select()
      .from(formulas)
      .where(and(eq(formulas.id, formulaId), eq(formulas.ownerId, ownerId)))
      .limit(1);
    const formula = rows.find((row) => row.id === formulaId && row.ownerId === ownerId);
    if (!formula) throw new NotFoundException('Formula not found');
    return formula;
  }

  private async clockOwnerIds(): Promise<string[]> {
    const result = await this.db
      .client()
      .execute(sql`SELECT owner_id FROM lab.notification_clock_owner_ids()`);
    const rows = (result as { rows?: Array<{ owner_id?: string }> }).rows ?? [];
    return rows.flatMap((row) => (row.owner_id ? [row.owner_id] : []));
  }
}
