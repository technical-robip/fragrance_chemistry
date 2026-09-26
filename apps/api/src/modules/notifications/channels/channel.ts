export type DeliverySkipReason =
  'not_configured' | 'native_not_implemented' | 'sender_not_implemented';

export type DeliveryResult =
  { status: 'delivered' } | { status: 'skipped'; reason: DeliverySkipReason };

export type NotificationDeliveryMessage = {
  ownerId: string;
  dedupeKey: string;
  kind: 'evaluation.checkpoint';
  payload: {
    kind: 'evaluation.checkpoint';
    checkpointKey: string;
    formulaId: string;
    deepLink: { path: string; query: Record<string, string> };
  };
};

export interface NotificationChannel {
  readonly id: 'in_app' | 'email' | 'push';
  deliver(message: NotificationDeliveryMessage): Promise<DeliveryResult>;
}
