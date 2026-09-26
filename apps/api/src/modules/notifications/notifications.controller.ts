import { Body, Controller, Get, Param, Patch, Post, Put, Req } from '@nestjs/common';
import {
  formulaNotificationMuteBodySchema,
  FormulaNotificationMuteBody,
  simulateNotificationBodySchema,
  SimulateNotificationBody,
  updateNotificationPreferencesBodySchema,
  UpdateNotificationPreferencesBody,
} from '@fc/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtPayload } from '../auth/auth.types';
import { RequiresFeature } from '../auth/roles.decorator';
import { NotificationsService } from './notifications.service';

const idSchema = z.string().uuid();

@Controller('notifications')
@RequiresFeature('evaluation')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Req() req: { user: JwtPayload }) {
    return this.notifications.syncUser(req.user.sub);
  }

  @Post(':id/read')
  read(@Req() req: { user: JwtPayload }, @Param('id', new ZodValidationPipe(idSchema)) id: string) {
    return this.notifications.markRead(req.user.sub, id);
  }

  @Post(':id/dismiss')
  dismiss(
    @Req() req: { user: JwtPayload },
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
  ) {
    return this.notifications.dismiss(req.user.sub, id);
  }
}

@Controller('notification-preferences')
@RequiresFeature('evaluation')
export class NotificationPreferencesController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  get(@Req() req: { user: JwtPayload }) {
    return this.notifications.getPreferences(req.user.sub);
  }

  @Patch()
  update(
    @Req() req: { user: JwtPayload },
    @Body(new ZodValidationPipe(updateNotificationPreferencesBodySchema))
    body: UpdateNotificationPreferencesBody,
  ) {
    return this.notifications.updatePreferences(req.user.sub, body);
  }
}

@Controller('formulas')
@RequiresFeature('evaluation')
export class FormulaNotificationMuteController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get(':id/notification-mute')
  get(@Req() req: { user: JwtPayload }, @Param('id', new ZodValidationPipe(idSchema)) id: string) {
    return this.notifications.getFormulaMute(req.user.sub, id);
  }

  @Put(':id/notification-mute')
  put(
    @Req() req: { user: JwtPayload },
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(formulaNotificationMuteBodySchema))
    body: FormulaNotificationMuteBody,
  ) {
    return this.notifications.setFormulaMute(req.user.sub, id, body.muted);
  }
}

/** Registered only outside production. Moves a formula clock and runs the same sync. */
@Controller('notifications')
@RequiresFeature('evaluation')
export class NotificationsDevController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post('dev/simulate')
  simulate(
    @Req() req: { user: JwtPayload },
    @Body(new ZodValidationPipe(simulateNotificationBodySchema)) body: SimulateNotificationBody,
  ) {
    return this.notifications.simulate(req.user.sub, body);
  }
}
