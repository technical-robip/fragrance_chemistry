import { NotFoundException } from '@nestjs/common';
import { getTableName } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { InAppChannel } from './channels/in-app.channel';
import { PushChannel } from './channels/push.channel';
import { ResendEmailChannel } from './channels/resend-email.channel';
import { NotificationsService } from './notifications.service';

const ownerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const formulaId = '11111111-1111-4111-8111-111111111111';
const startedAt = new Date('2026-01-01T00:00:00.000Z');

function fieldName(column: string) {
  return column.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

function eqMap(expr: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const walk = (node: any) => {
    const chunks = node?.queryChunks;
    if (!Array.isArray(chunks)) return;
    for (let i = 0; i < chunks.length - 2; i += 1) {
      const column = chunks[i];
      const op = chunks[i + 1];
      const param = chunks[i + 2];
      const opText = Array.isArray(op?.value) ? op.value.join('') : '';
      if (column?.name && opText.includes('=') && param && 'value' in param) {
        out[column.name] = param.value;
      }
    }
    for (const chunk of chunks) walk(chunk);
  };
  walk(expr);
  return out;
}

function matches(row: Record<string, unknown>, pred: Record<string, unknown>) {
  return Object.entries(pred).every(([column, value]) => row[fieldName(column)] === value);
}

function sameIdentity(table: string, left: any, right: any) {
  if (table === 'user_notification_preferences') return left.userId === right.userId;
  if (table === 'notifications') {
    return left.ownerId === right.ownerId && left.dedupeKey === right.dedupeKey;
  }
  if (table === 'maceration_clocks' || table === 'formula_notification_mutes') {
    return left.ownerId === right.ownerId && left.formulaId === right.formulaId;
  }
  return false;
}

function createDb(initial: Record<string, any[]> = {}, owners: string[] = []) {
  const store: Record<string, any[]> = {};
  for (const [name, rows] of Object.entries(initial)) store[name] = rows.map((row) => ({ ...row }));

  function bucket(table: unknown) {
    const name = getTableName(table as any);
    store[name] ??= [];
    return { name, rows: store[name] };
  }

  const client = {
    select() {
      let tableRows: any[] = [];
      let pred: Record<string, unknown> | null = null;
      let cap: number | null = null;
      const query: any = {
        from(table: unknown) {
          tableRows = bucket(table).rows;
          return query;
        },
        where(expr: unknown) {
          pred = eqMap(expr);
          return query;
        },
        orderBy() {
          return query;
        },
        limit(count: number) {
          cap = count;
          return query;
        },
        then(onFulfilled: any, onRejected: any) {
          let rows = tableRows.filter((row) => (pred ? matches(row, pred) : true));
          if (cap != null) rows = rows.slice(0, cap);
          return Promise.resolve(rows.map((row) => ({ ...row }))).then(onFulfilled, onRejected);
        },
      };
      return query;
    },
    insert(table: unknown) {
      const { name, rows } = bucket(table);
      return {
        values(value: any) {
          let conflict: 'nothing' | 'update' | null = null;
          const stored = {
            status: 'open',
            createdAt: new Date(),
            readAt: null,
            ...value,
            id: value.id ?? crypto.randomUUID(),
          };
          const commit = () => {
            const existing = rows.find((row) => sameIdentity(name, row, stored));
            if (existing && conflict === 'nothing') return [];
            if (existing && conflict === 'update') {
              Object.assign(existing, stored);
              return [{ ...existing }];
            }
            rows.push(stored);
            return [{ ...stored }];
          };
          const exec: any = {
            onConflictDoNothing() {
              conflict = 'nothing';
              return exec;
            },
            onConflictDoUpdate() {
              conflict = 'update';
              return exec;
            },
            returning() {
              return Promise.resolve(commit());
            },
            then(onFulfilled: any, onRejected: any) {
              return Promise.resolve(commit()).then(onFulfilled, onRejected);
            },
          };
          return exec;
        },
      };
    },
    update(table: unknown) {
      const { rows } = bucket(table);
      let patch = {};
      let pred: Record<string, unknown> = {};
      const apply = () => {
        const updated: any[] = [];
        for (const row of rows) {
          if (matches(row, pred)) {
            Object.assign(row, patch);
            updated.push({ ...row });
          }
        }
        return updated;
      };
      const exec: any = {
        set(value: any) {
          patch = value;
          return exec;
        },
        where(expr: unknown) {
          pred = eqMap(expr);
          return exec;
        },
        returning() {
          return Promise.resolve(apply());
        },
        then(onFulfilled: any, onRejected: any) {
          return Promise.resolve(apply()).then(onFulfilled, onRejected);
        },
      };
      return exec;
    },
    delete(table: unknown) {
      const { rows } = bucket(table);
      const exec: any = {
        where(expr: unknown) {
          const pred = eqMap(expr);
          const kept = rows.filter((row) => !matches(row, pred));
          rows.splice(0, rows.length, ...kept);
          return exec;
        },
        then(onFulfilled: any, onRejected: any) {
          return Promise.resolve(undefined).then(onFulfilled, onRejected);
        },
      };
      return exec;
    },
    execute: vi.fn(async () => ({ rows: owners.map((owner_id) => ({ owner_id })) })),
  };

  return { store, client };
}

function channels() {
  return {
    inApp: {
      id: 'in_app' as const,
      deliver: vi.fn(async () => ({ status: 'delivered' as const })),
    },
    email: {
      id: 'email' as const,
      deliver: vi.fn(async () => ({
        status: 'skipped' as const,
        reason: 'not_configured' as const,
      })),
    },
    push: {
      id: 'push' as const,
      deliver: vi.fn(async () => ({
        status: 'skipped' as const,
        reason: 'native_not_implemented' as const,
      })),
    },
  };
}

function serviceFor(
  db: ReturnType<typeof createDb>,
  outbound = channels(),
  cls = { run: async (fn: () => Promise<unknown>) => fn() },
) {
  const database = {
    client: () => db.client,
    runWithTenant: async (_owner: string, fn: () => Promise<unknown>) => fn(),
  };
  const svc = new NotificationsService(
    database as any,
    cls as any,
    outbound.inApp as any,
    outbound.email as any,
    outbound.push as any,
  );
  return { svc, outbound, database };
}

function seedDue() {
  return createDb({
    formulas: [{ id: formulaId, ownerId, name: 'Rose study' }],
    maceration_clocks: [{ id: 'clock-1', ownerId, formulaId, startedAt }],
    evaluations: [
      {
        id: 'eval-1',
        ownerId,
        formulaId,
        macerationDay: 1,
        notes: null,
        t0Notes: null,
        t30mNotes: null,
        t4hNotes: null,
        t24hNotes: null,
      },
    ],
  });
}

describe('NotificationsService', () => {
  it('opens a due empty checkpoint once and does not repeat it', async () => {
    const db = seedDue();
    const { svc, outbound } = serviceFor(db);
    const now = new Date(startedAt.getTime() + 1000);
    const first = await svc.syncUser(ownerId, now);
    expect(first.items.map((item) => item.checkpointKey)).toEqual(['t0']);
    expect(first.items[0]).toMatchObject({
      formulaName: 'Rose study',
      unread: true,
      deepLink: { path: '/evaluation', query: { formula: formulaId, day: '1', slot: 't0Notes' } },
    });
    expect(first.unreadCount).toBe(1);
    expect(outbound.email.deliver).toHaveBeenCalledTimes(1);
    expect(outbound.push.deliver).toHaveBeenCalledTimes(1);
    expect(outbound.inApp.deliver).toHaveBeenCalledTimes(1);

    const second = await svc.syncUser(ownerId, now);
    expect(second.items).toHaveLength(1);
    expect(outbound.email.deliver).toHaveBeenCalledTimes(1);
    expect(db.store.notifications).toHaveLength(1);
  });

  it('keeps a dismissed checkpoint closed and still opens the next one', async () => {
    const db = seedDue();
    const { svc } = serviceFor(db);
    const opened = await svc.syncUser(ownerId, new Date(startedAt.getTime() + 1000));
    await svc.dismiss(ownerId, opened.items[0]!.id);
    const afterDismiss = await svc.syncUser(ownerId, new Date(startedAt.getTime() + 1000));
    expect(afterDismiss.items).toEqual([]);

    const later = await svc.syncUser(ownerId, new Date(startedAt.getTime() + 30 * 60 * 1000));
    expect(later.items.map((item) => item.checkpointKey)).toEqual(['t30m']);
    expect(db.store.notifications.find((row) => row.checkpointKey === 't0')?.status).toBe(
      'dismissed',
    );
  });

  it('hides a muted formula until reminders are turned back on', async () => {
    const db = seedDue();
    const { svc } = serviceFor(db);
    const now = new Date(startedAt.getTime() + 1000);
    await svc.syncUser(ownerId, now);
    await svc.setFormulaMute(ownerId, formulaId, true);
    expect((await svc.syncUser(ownerId, now)).items).toEqual([]);
    expect(await svc.getFormulaMute(ownerId, formulaId)).toEqual({ formulaId, muted: true });

    await svc.setFormulaMute(ownerId, formulaId, false);
    const restored = await svc.syncUser(ownerId, new Date('2026-09-01T00:00:00.000Z'));
    expect(new Set(restored.items.map((item) => item.checkpointKey))).toEqual(
      new Set(['t0', 't30m', 't4h', 't24h', 'd7', 'd14', 'd30']),
    );
    expect(await svc.getFormulaMute(ownerId, formulaId)).toEqual({ formulaId, muted: false });
  });

  it('resolves the checkpoint when the slot is filled', async () => {
    const db = seedDue();
    const { svc } = serviceFor(db);
    const now = new Date(startedAt.getTime() + 1000);
    await svc.syncUser(ownerId, now);
    db.store.evaluations[0].t0Notes = 'opened';
    const inbox = await svc.syncUser(ownerId, now);
    expect(inbox.items).toEqual([]);
    expect(db.store.notifications[0].status).toBe('resolved');
  });

  it('opens nothing while the global reminder switch is off', async () => {
    const db = seedDue();
    db.store.user_notification_preferences = [
      { userId: ownerId, evaluationEnabled: false, emailEnabled: false },
    ];
    const { svc, outbound } = serviceFor(db);
    const inbox = await svc.syncUser(ownerId, new Date(startedAt.getTime() + 1000));
    expect(inbox).toEqual({ unreadCount: 0, items: [] });
    expect(outbound.email.deliver).not.toHaveBeenCalled();
    expect(db.store.notifications ?? []).toHaveLength(0);
  });

  it('starts the clock on day 1 and leaves day 7 alone', async () => {
    const db = createDb({
      formulas: [{ id: formulaId, ownerId, name: 'Rose study' }],
    });
    const { svc } = serviceFor(db);
    await svc.onEvaluationSaved(ownerId, formulaId, 7);
    expect(db.store.maceration_clocks ?? []).toHaveLength(0);

    await svc.onEvaluationSaved(ownerId, formulaId, 1);
    expect(db.store.maceration_clocks).toHaveLength(1);
    const again = db.store.maceration_clocks[0].startedAt;
    await svc.onEvaluationSaved(ownerId, formulaId, 1);
    expect(db.store.maceration_clocks).toHaveLength(1);
    expect(db.store.maceration_clocks[0].startedAt).toBe(again);
  });

  it('moves the clock in simulate and refuses a formula that has not started', async () => {
    const db = seedDue();
    const { svc } = serviceFor(db);
    const now = new Date('2026-03-01T00:00:00.000Z');
    const inbox = await svc.simulate(ownerId, { formulaId, atCheckpoint: 't30m' }, now);
    expect(inbox.items.map((item) => item.checkpointKey)).toEqual(['t0', 't30m']);
    expect(db.store.maceration_clocks[0].startedAt).toEqual(
      new Date(now.getTime() - 30 * 60 * 1000 - 1000),
    );

    const bare = createDb({ formulas: [{ id: formulaId, ownerId, name: 'Rose study' }] });
    const bareSvc = serviceFor(bare).svc;
    await expect(
      bareSvc.simulate(ownerId, { formulaId, atCheckpoint: 'd7' }, now),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      bareSvc.getFormulaMute(ownerId, '22222222-2222-4222-8222-222222222222'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('marks a reminder read and rejects an unknown id', async () => {
    const db = seedDue();
    const { svc } = serviceFor(db);
    const opened = await svc.syncUser(ownerId, new Date(startedAt.getTime() + 1000));
    const id = opened.items[0]!.id;
    expect((await svc.markRead(ownerId, id)).unread).toBe(false);
    expect((await svc.markRead(ownerId, id)).unread).toBe(false);
    const inbox = await svc.syncUser(ownerId, new Date(startedAt.getTime() + 1000));
    expect(inbox.unreadCount).toBe(0);
    expect(inbox.items[0]?.unread).toBe(false);

    await expect(
      svc.dismiss(ownerId, '33333333-3333-4333-8333-333333333333'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await svc.dismiss(ownerId, id);
    expect((await svc.dismiss(ownerId, id)).status).toBe('dismissed');
  });

  it('keeps the in-app row when email delivery throws', async () => {
    const db = seedDue();
    const outbound = channels();
    outbound.email.deliver.mockRejectedValue(new Error('resend down'));
    const { svc } = serviceFor(db, outbound);
    const inbox = await svc.syncUser(ownerId, new Date(startedAt.getTime() + 1000));
    expect(inbox.items).toHaveLength(1);
    expect(outbound.push.deliver).toHaveBeenCalledTimes(1);
    expect(db.store.notifications).toHaveLength(1);
  });

  it('stores preferences and leaves an omitted flag unchanged', async () => {
    const db = createDb();
    const { svc } = serviceFor(db);
    expect(await svc.getPreferences(ownerId)).toEqual({
      evaluationEnabled: true,
      emailEnabled: false,
    });
    expect(await svc.updatePreferences(ownerId, { evaluationEnabled: false })).toEqual({
      evaluationEnabled: false,
      emailEnabled: false,
    });
    expect(await svc.updatePreferences(ownerId, { emailEnabled: true })).toEqual({
      evaluationEnabled: false,
      emailEnabled: true,
    });
  });

  it('sweeps each clock owner inside that owner tenant', async () => {
    const db = seedDue();
    db.client.execute.mockResolvedValue({
      rows: [{ owner_id: ownerId }, {}, { owner_id: '' }],
    });
    const seen: string[] = [];
    const { svc } = serviceFor(db, channels(), {
      run: async (fn) => fn(),
    });
    const database = (svc as any).db;
    database.runWithTenant = async (id: string, fn: () => Promise<unknown>) => {
      seen.push(id);
      return fn();
    };
    const result = await svc.sweepActiveClocks(new Date(startedAt.getTime() + 1000));
    expect(result).toEqual({ users: 1 });
    expect(seen).toEqual([ownerId]);
    expect(db.store.notifications).toHaveLength(1);
  });

  it('skips rows that are not evaluation checkpoints', async () => {
    const db = seedDue();
    db.store.notifications = [
      {
        id: 'other',
        ownerId,
        formulaId,
        kind: 'something.else',
        dedupeKey: 'something.else:x',
        checkpointKey: 'nope',
        status: 'open',
        payload: {},
        createdAt: startedAt,
        readAt: null,
      },
    ];
    const { svc } = serviceFor(db);
    const inbox = await svc.syncUser(ownerId, new Date(startedAt.getTime() + 1000));
    expect(inbox.items.map((item) => item.checkpointKey)).toEqual(['t0']);
  });
});

describe('notification channels', () => {
  it('delivers in-app and skips native push', async () => {
    const message = {
      ownerId,
      dedupeKey: 'evaluation.checkpoint:x:t0',
      kind: 'evaluation.checkpoint' as const,
      payload: {
        kind: 'evaluation.checkpoint' as const,
        checkpointKey: 't0',
        formulaId,
        deepLink: { path: '/evaluation', query: { formula: formulaId, day: '1' } },
      },
    };
    expect(await new InAppChannel().deliver(message)).toEqual({ status: 'delivered' });
    expect(await new PushChannel().deliver(message)).toEqual({
      status: 'skipped',
      reason: 'native_not_implemented',
    });
  });

  it('does not call fetch for Resend, configured or not', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const message = {
      ownerId,
      dedupeKey: 'k',
      kind: 'evaluation.checkpoint' as const,
      payload: {
        kind: 'evaluation.checkpoint' as const,
        checkpointKey: 't0',
        formulaId,
        deepLink: { path: '/evaluation', query: {} },
      },
    };
    expect(await new ResendEmailChannel({ enabled: false }).deliver(message)).toEqual({
      status: 'skipped',
      reason: 'not_configured',
    });
    expect(
      await new ResendEmailChannel({ enabled: true, apiKey: 're_test' }).deliver(message),
    ).toEqual({ status: 'skipped', reason: 'sender_not_implemented' });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
