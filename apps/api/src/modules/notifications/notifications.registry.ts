import {
  FormulaNotificationMuteController,
  NotificationPreferencesController,
  NotificationsController,
  NotificationsDevController,
} from './notifications.controller';

export function notificationControllerClasses(nodeEnv: string) {
  const live = [
    NotificationsController,
    NotificationPreferencesController,
    FormulaNotificationMuteController,
  ];
  if (nodeEnv === 'production') return live;
  return [...live, NotificationsDevController];
}
