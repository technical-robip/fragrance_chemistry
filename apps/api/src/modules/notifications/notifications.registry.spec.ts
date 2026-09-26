import { describe, expect, it } from 'vitest';
import { NotificationsDevController } from './notifications.controller';
import { notificationControllerClasses } from './notifications.registry';

describe('notificationControllerClasses', () => {
  it('omits the simulate route in production', () => {
    const production = notificationControllerClasses('production');
    const development = notificationControllerClasses('development');
    expect(production).not.toContain(NotificationsDevController);
    expect(development).toContain(NotificationsDevController);
    expect(development.length).toBe(production.length + 1);
  });
});
