import { describe, expect, it } from 'vitest';
import {
  EVALUATION_CHECKPOINTS,
  dueEvaluationCheckpoints,
  evaluationCheckpointDedupeKey,
  formulaNotificationMuteBodySchema,
  isEvaluationCheckpointKey,
  simulateNotificationBodySchema,
  startedAtForCheckpoint,
  updateNotificationPreferencesBodySchema,
  type EvaluationSittingSnapshot,
  type SimulateCheckpoint,
} from './notifications';

const formulaId = '11111111-1111-4111-8111-111111111111';
const start = new Date('2026-01-01T00:00:00.000Z');

function sitting(
  partial: Partial<EvaluationSittingSnapshot> & Pick<EvaluationSittingSnapshot, 'macerationDay'>,
): EvaluationSittingSnapshot {
  return { formulaId, notes: null, ...partial };
}

function due(
  now: Date,
  options: {
    sittings?: EvaluationSittingSnapshot[];
    evaluationEnabled?: boolean;
    formulaMuted?: boolean;
    recorded?: Array<{ checkpointKey: string; status: 'open' | 'dismissed' | 'resolved' }>;
    startedAt?: Date | string;
  } = {},
) {
  return dueEvaluationCheckpoints({
    formulaId,
    startedAt: options.startedAt ?? start,
    now,
    sittings: options.sittings ?? [],
    evaluationEnabled: options.evaluationEnabled ?? true,
    formulaMuted: options.formulaMuted ?? false,
    recorded: options.recorded ?? [],
  });
}

describe('evaluation checkpoint schedule', () => {
  it('offsets match the day-1 slots and the 7, 14, and 30 day marks', () => {
    const byKey = Object.fromEntries(EVALUATION_CHECKPOINTS.map((row) => [row.key, row.offsetMs]));
    expect(byKey.t0).toBe(0);
    expect(byKey.t30m).toBe(30 * 60 * 1000);
    expect(byKey.t4h).toBe(4 * 60 * 60 * 1000);
    expect(byKey.t24h).toBe(24 * 60 * 60 * 1000);
    expect(byKey.d7).toBe(7 * 24 * 60 * 60 * 1000);
    expect(byKey.d14).toBe(14 * 24 * 60 * 60 * 1000);
    expect(byKey.d30).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('builds a stable dedupe key and recognizes checkpoint keys', () => {
    expect(evaluationCheckpointDedupeKey(formulaId, 't30m')).toBe(
      `evaluation.checkpoint:${formulaId}:t30m`,
    );
    expect(isEvaluationCheckpointKey('d14')).toBe(true);
    expect(isEvaluationCheckpointKey('t2h')).toBe(false);
  });

  it('places the clock just before a simulated checkpoint', () => {
    const now = new Date('2026-06-01T12:00:00.000Z');
    const started = startedAtForCheckpoint('d7', now);
    expect(now.getTime() - started.getTime()).toBe(7 * 24 * 60 * 60 * 1000 + 1000);
    expect(() => startedAtForCheckpoint('nope' as SimulateCheckpoint, now)).toThrow(
      /Unknown checkpoint/,
    );
  });
});

describe('dueEvaluationCheckpoints', () => {
  it('opens an empty slot once it is due, with a relative deep link', () => {
    const actions = due(new Date(start.getTime() + 30 * 60 * 1000));
    expect(actions.map((action) => action.checkpointKey)).toEqual(['t0', 't30m']);
    const t30 = actions.find((action) => action.checkpointKey === 't30m');
    expect(t30).toMatchObject({
      action: 'open',
      dedupeKey: `evaluation.checkpoint:${formulaId}:t30m`,
      deepLink: {
        path: '/evaluation',
        query: { formula: formulaId, day: '1', slot: 't30mNotes' },
      },
    });
  });

  it('omits the slot on later-day links and skips checkpoints that are not due yet', () => {
    const actions = due(new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1));
    expect(actions.some((action) => action.checkpointKey === 'd7')).toBe(false);
    const atDay7 = due(new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000));
    const day7 = atDay7.find((action) => action.checkpointKey === 'd7');
    expect(day7).toMatchObject({
      action: 'open',
      deepLink: { query: { formula: formulaId, day: '7' } },
    });
    expect(day7 && day7.action === 'open' ? day7.deepLink.query.slot : 'present').toBeUndefined();
  });

  it('does not open a slot that already has text, including a later sitting', () => {
    const actions = due(new Date(start.getTime() + 60_000), {
      sittings: [
        sitting({ macerationDay: 1, t0Notes: '   ' }),
        sitting({ macerationDay: 1, t0Notes: 'bright open' }),
      ],
    });
    expect(actions.map((action) => action.checkpointKey)).not.toContain('t0');
  });

  it('treats a day 7 or 30 note as complete', () => {
    const now = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
    const withNotes = due(now, {
      sittings: [sitting({ macerationDay: 7, notes: 'rounder' })],
    });
    expect(withNotes.some((action) => action.checkpointKey === 'd7')).toBe(false);

    const withSlot = due(now, {
      sittings: [sitting({ macerationDay: 30, t0Notes: 'settled' })],
    });
    expect(withSlot.some((action) => action.checkpointKey === 'd30')).toBe(false);
  });

  it('does not open anything while reminders are off or the formula is muted', () => {
    const now = new Date(start.getTime() + 60_000);
    expect(due(now, { evaluationEnabled: false })).toEqual([]);
    expect(due(now, { formulaMuted: true })).toEqual([]);
  });

  it('still resolves a filled open row when reminders are muted', () => {
    const actions = due(start, {
      formulaMuted: true,
      evaluationEnabled: false,
      sittings: [sitting({ macerationDay: 1, t0Notes: 'done' })],
      recorded: [{ checkpointKey: 't0', status: 'open' }],
    });
    expect(actions).toEqual([
      {
        action: 'resolve',
        checkpointKey: 't0',
        dedupeKey: `evaluation.checkpoint:${formulaId}:t0`,
      },
    ]);
  });

  it('resolves a dismissed row once the slot is filled and does not reopen it', () => {
    const actions = due(new Date(start.getTime() + 60_000), {
      sittings: [sitting({ macerationDay: 1, t0Notes: 'filled later' })],
      recorded: [{ checkpointKey: 't0', status: 'dismissed' }],
    });
    expect(actions.filter((action) => action.checkpointKey === 't0')).toEqual([
      {
        action: 'resolve',
        checkpointKey: 't0',
        dedupeKey: `evaluation.checkpoint:${formulaId}:t0`,
      },
    ]);
  });

  it('leaves a resolved checkpoint closed even if the note is cleared', () => {
    const actions = due(new Date(start.getTime() + 60_000), {
      recorded: [{ checkpointKey: 't0', status: 'resolved' }],
    });
    expect(actions.some((action) => action.checkpointKey === 't0')).toBe(false);
    expect(actions.some((action) => action.checkpointKey === 't30m')).toBe(false);
  });

  it('does not repeat an open checkpoint, and a dismissal does not block the next one', () => {
    const now = new Date(start.getTime() + 30 * 60 * 1000);
    const actions = due(now, {
      recorded: [
        { checkpointKey: 't0', status: 'dismissed' },
        { checkpointKey: 't30m', status: 'open' },
        { checkpointKey: 'nope', status: 'open' },
      ],
    });
    expect(actions).toEqual([]);
  });

  it('opens the next checkpoint after an earlier one was dismissed', () => {
    const actions = due(new Date(start.getTime() + 30 * 60 * 1000), {
      recorded: [{ checkpointKey: 't0', status: 'dismissed' }],
    });
    expect(actions.map((action) => action.checkpointKey)).toEqual(['t30m']);
  });

  it('rejects an unreadable clock', () => {
    expect(() => due(start, { startedAt: 'not-a-date' })).toThrow(/startedAt/);
    expect(() =>
      dueEvaluationCheckpoints({
        formulaId,
        startedAt: start,
        now: 'nope',
        sittings: [],
        evaluationEnabled: true,
        formulaMuted: false,
        recorded: [],
      }),
    ).toThrow(/now/);
  });

  it('accepts ISO strings for the clock', () => {
    const actions = due(new Date(start.getTime() + 1000), {
      startedAt: start.toISOString(),
    });
    expect(actions[0]?.checkpointKey).toBe('t0');
  });
});

describe('notification body schemas', () => {
  it('requires at least one preference field', () => {
    expect(updateNotificationPreferencesBodySchema.safeParse({}).success).toBe(false);
    expect(
      updateNotificationPreferencesBodySchema.parse({ evaluationEnabled: false }).evaluationEnabled,
    ).toBe(false);
  });

  it('accepts a mute flag and a simulate checkpoint', () => {
    expect(formulaNotificationMuteBodySchema.parse({ muted: true }).muted).toBe(true);
    expect(
      simulateNotificationBodySchema.parse({ formulaId, atCheckpoint: 't4h' }).atCheckpoint,
    ).toBe('t4h');
    expect(
      simulateNotificationBodySchema.safeParse({ formulaId, atCheckpoint: 't0' }).success,
    ).toBe(false);
  });
});
