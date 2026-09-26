# Notification engine

The due-ness rules live in `packages/shared/src/notifications.ts`. Delivery is a channel port in `apps/api/src/modules/notifications`. The web app is one client of the same REST contract a native app can call later.

## What ships now

- In-app inbox for unfinished maceration evaluations.
- The clock starts at the first Day 1 save for that formula and does not move again.
- Checkpoints, measured from that clock: T+0, T+30 min, T+4 h, T+24 h, then 7, 14, and 30 days.
- A checkpoint is open only while its slot is still empty. Day 1 uses `t0Notes` … `t24hNotes`. Later days use `notes` or `t0Notes`, the same rule as `describeOpenSitting`.
- Evaluation reminders default to on. Absence of a preferences row means on.
- Dismiss closes that checkpoint only. Mute on a formula stops every future checkpoint until the user turns it back on from the evaluation page.
- `GET /api/v1/notifications` syncs the signed-in user and returns the open inbox. It does not need Redis.
- A BullMQ job named `notification-sweep` runs every five minutes and calls the same sync for each owner that has a clock. That job is the hook for later email and push. The inbox does not wait for it.
- Resend does not send. `PushChannel` does not send.

## Data

Migration `apps/api/drizzle/0013_notifications.sql`:

| Table                                | Role                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| `lab.maceration_clocks`              | One immutable `started_at` per owner and formula                                  |
| `core.user_notification_preferences` | `evaluation_enabled` (default true), `email_enabled` (default false, stored only) |
| `lab.formula_notification_mutes`     | Persistent mute                                                                   |
| `lab.notifications`                  | Inbox rows. Unique on `(owner_id, dedupe_key)`                                    |

Rows are removed when the formula is deleted. `lab.notification_clock_owner_ids()` is a security-definer function so the sweep can list owners under row-level security. It must stay owned by a role that bypasses RLS (the migrator superuser).

## HTTP

All routes require the `evaluation` feature and the caller's JWT.

- `GET /notifications`
- `POST /notifications/:id/read`
- `POST /notifications/:id/dismiss`
- `GET /notification-preferences`
- `PATCH /notification-preferences` with `{ evaluationEnabled?, emailEnabled? }`
- `GET /formulas/:id/notification-mute`
- `PUT /formulas/:id/notification-mute` with `{ muted: boolean }`
- `POST /notifications/dev/simulate` with `{ formulaId, atCheckpoint }` — registered only when `NODE_ENV` is not `production`. `atCheckpoint` is `t30m`, `t4h`, `t24h`, `d7`, `d14`, or `d30`.

Deep links are relative: `{ path: "/evaluation", query: { formula, day, slot? } }`. No absolute URL.

## Add a notification kind

1. Add a pure planner next to `dueEvaluationCheckpoints`. It must return `open` and `resolve` actions and a dedupe key. Do not import Nest or the DOM.
2. Teach `NotificationsService.syncUser` to load whatever rows that planner needs and to apply the actions. Keep the insert idempotent with `onConflictDoNothing` on `(owner_id, dedupe_key)`.
3. Store `kind` and a JSON `payload` that includes `deepLink`. The inbox already ignores unknown checkpoint keys.
4. Add copy under `notifications.checkpoint` in all six locale files, or a new namespace if the kind is not a checkpoint.
5. Cover the planner in `packages/shared` and the sync, dismiss, and mute paths in `notifications.service.spec.ts`.

Outbound channels run only when a row is inserted, not on every later sync.

## Channels

`NotificationChannel` is `deliver(message) => { status: 'delivered' } | { status: 'skipped', reason }`.

- `InAppChannel` — the database row is the delivery. `deliver` only acknowledges it.
- `ResendEmailChannel` — returns `not_configured` unless `NOTIFICATIONS_EMAIL_ENABLED=true` and `RESEND_API_KEY` are both set. Even then it returns `sender_not_implemented` and does not call the network. To send for real, replace that return with the Resend HTTP call and add a test that asserts the request shape. Do not add a live-send test against the real API.
- `PushChannel` — returns `native_not_implemented`. A native client should register a device token and implement this port (APNs or FCM). The shared payload and the REST routes stay the same.

`email_enabled` is persisted so a later sender can honor it. The web UI does not present email as working.

## Native client

Use the shared package for checkpoint keys, dedupe keys, and the preference schemas. Call the routes above with the same bearer token. Open `deepLink.path` plus `deepLink.query` inside the app. Do not parse HTML. The sweep already invokes `PushChannel` for each newly opened row; implement `deliver` there when a device token exists.

## Simulate and clean up

`POST /notifications/dev/simulate` rewinds `started_at` so the chosen checkpoint is just due, then runs sync. Use it from Playwright (`apps/web/e2e/notifications.spec.ts`) and from a local browser check. Name disposable formulas `sim-notif-…` or `__smoke notif …` and delete them when finished so clocks and inbox rows go with the formula. Turn the account reminder switch back on if a check turned it off.
