import { z } from 'zod';
import { isDayOne, type SittingNotes } from './evaluations';

/** Stable kind for maceration checkpoint reminders. New kinds get their own planner. */
export const EVALUATION_NOTIFICATION_KIND = 'evaluation.checkpoint' as const;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const EVALUATION_CHECKPOINTS = [
  { key: 't0', offsetMs: 0, day: 1, slot: 't0Notes' },
  { key: 't30m', offsetMs: 30 * MINUTE_MS, day: 1, slot: 't30mNotes' },
  { key: 't4h', offsetMs: 4 * HOUR_MS, day: 1, slot: 't4hNotes' },
  { key: 't24h', offsetMs: 24 * HOUR_MS, day: 1, slot: 't24hNotes' },
  { key: 'd7', offsetMs: 7 * DAY_MS, day: 7, slot: null },
  { key: 'd14', offsetMs: 14 * DAY_MS, day: 14, slot: null },
  { key: 'd30', offsetMs: 30 * DAY_MS, day: 30, slot: null },
] as const;

export type EvaluationCheckpointKey = (typeof EVALUATION_CHECKPOINTS)[number]['key'];
export type EvaluationCheckpoint = (typeof EVALUATION_CHECKPOINTS)[number];

/** Checkpoints the dev simulate route is allowed to jump to. T+0 is already due at start. */
export const SIMULATE_CHECKPOINTS = ['t30m', 't4h', 't24h', 'd7', 'd14', 'd30'] as const;
export type SimulateCheckpoint = (typeof SIMULATE_CHECKPOINTS)[number];

export const NOTIFICATION_STATUSES = ['open', 'dismissed', 'resolved'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export type NotificationDeepLink = {
  path: '/evaluation';
  query: Record<string, string>;
};

export type NotificationPayload = {
  kind: typeof EVALUATION_NOTIFICATION_KIND;
  checkpointKey: EvaluationCheckpointKey;
  formulaId: string;
  deepLink: NotificationDeepLink;
};

export type EvaluationSittingSnapshot = SittingNotes & {
  formulaId: string;
  macerationDay: number | null;
};

export type RecordedCheckpoint = {
  checkpointKey: string;
  status: NotificationStatus;
};

export type DueCheckpointAction =
  | {
      action: 'open';
      kind: typeof EVALUATION_NOTIFICATION_KIND;
      checkpointKey: EvaluationCheckpointKey;
      dedupeKey: string;
      formulaId: string;
      deepLink: NotificationDeepLink;
    }
  | {
      action: 'resolve';
      checkpointKey: EvaluationCheckpointKey;
      dedupeKey: string;
    };

export type NotificationInboxItem = {
  id: string;
  kind: typeof EVALUATION_NOTIFICATION_KIND;
  checkpointKey: EvaluationCheckpointKey;
  formulaId: string;
  formulaName: string;
  status: 'open';
  unread: boolean;
  deepLink: NotificationDeepLink;
  createdAt: string;
};

export type NotificationInbox = {
  unreadCount: number;
  items: NotificationInboxItem[];
};

export type NotificationPreferences = {
  evaluationEnabled: boolean;
  emailEnabled: boolean;
};

export type FormulaNotificationMute = {
  formulaId: string;
  muted: boolean;
};

export function isEvaluationCheckpointKey(value: string): value is EvaluationCheckpointKey {
  return EVALUATION_CHECKPOINTS.some((checkpoint) => checkpoint.key === value);
}

export function evaluationCheckpointDedupeKey(
  formulaId: string,
  checkpointKey: EvaluationCheckpointKey,
): string {
  return `${EVALUATION_NOTIFICATION_KIND}:${formulaId}:${checkpointKey}`;
}

/** Move the maceration clock so `key` is just due at `now`. */
export function startedAtForCheckpoint(key: SimulateCheckpoint, now: Date): Date {
  const checkpoint = EVALUATION_CHECKPOINTS.find((item) => item.key === key);
  if (!checkpoint) throw new Error(`Unknown checkpoint: ${key}`);
  return new Date(now.getTime() - checkpoint.offsetMs - 1000);
}

export function evaluationDeepLink(
  formulaId: string,
  checkpoint: EvaluationCheckpoint,
): NotificationDeepLink {
  const query: Record<string, string> = {
    formula: formulaId,
    day: String(checkpoint.day),
  };
  if (checkpoint.slot) query.slot = checkpoint.slot;
  return { path: '/evaluation', query };
}

function toMs(value: Date | string, label: string): number {
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  if (Number.isNaN(ms)) throw new Error(`Invalid ${label}`);
  return ms;
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

function checkpointFilled(
  checkpoint: EvaluationCheckpoint,
  sittings: readonly EvaluationSittingSnapshot[],
): boolean {
  if (checkpoint.slot) {
    const slot = checkpoint.slot;
    return sittings.some((row) => isDayOne(row.macerationDay) && hasText(row[slot]));
  }
  return sittings.some(
    (row) =>
      (row.macerationDay ?? 0) === checkpoint.day && (hasText(row.notes) || hasText(row.t0Notes)),
  );
}

/**
 * Pure due-ness for one formula. Does not open when reminders are off or the formula is muted.
 * A filled slot resolves an existing row. Dismissed and resolved checkpoints are not reopened.
 */
export function dueEvaluationCheckpoints(input: {
  formulaId: string;
  startedAt: Date | string;
  now: Date | string;
  sittings: readonly EvaluationSittingSnapshot[];
  evaluationEnabled: boolean;
  formulaMuted: boolean;
  recorded: readonly RecordedCheckpoint[];
}): DueCheckpointAction[] {
  const startedMs = toMs(input.startedAt, 'startedAt');
  const nowMs = toMs(input.now, 'now');
  const recorded = new Map<EvaluationCheckpointKey, NotificationStatus>();
  for (const row of input.recorded) {
    if (!isEvaluationCheckpointKey(row.checkpointKey)) continue;
    recorded.set(row.checkpointKey, row.status);
  }

  const actions: DueCheckpointAction[] = [];
  for (const checkpoint of EVALUATION_CHECKPOINTS) {
    const status = recorded.get(checkpoint.key) ?? null;
    const filled = checkpointFilled(checkpoint, input.sittings);
    const dedupeKey = evaluationCheckpointDedupeKey(input.formulaId, checkpoint.key);

    if (filled && status && status !== 'resolved') {
      actions.push({ action: 'resolve', checkpointKey: checkpoint.key, dedupeKey });
      continue;
    }
    if (!input.evaluationEnabled || input.formulaMuted) continue;
    if (nowMs < startedMs + checkpoint.offsetMs || filled || status) continue;

    actions.push({
      action: 'open',
      kind: EVALUATION_NOTIFICATION_KIND,
      checkpointKey: checkpoint.key,
      dedupeKey,
      formulaId: input.formulaId,
      deepLink: evaluationDeepLink(input.formulaId, checkpoint),
    });
  }
  return actions;
}

export const updateNotificationPreferencesBodySchema = z
  .object({
    evaluationEnabled: z.boolean().optional(),
    emailEnabled: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'No fields to update' });

export const formulaNotificationMuteBodySchema = z.object({
  muted: z.boolean(),
});

export const simulateNotificationBodySchema = z.object({
  formulaId: z.string().uuid(),
  atCheckpoint: z.enum(SIMULATE_CHECKPOINTS),
});

export type UpdateNotificationPreferencesBody = z.infer<
  typeof updateNotificationPreferencesBodySchema
>;
export type FormulaNotificationMuteBody = z.infer<typeof formulaNotificationMuteBodySchema>;
export type SimulateNotificationBody = z.infer<typeof simulateNotificationBodySchema>;
