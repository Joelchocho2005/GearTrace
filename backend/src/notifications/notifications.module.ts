import { Module } from '@nestjs/common';
import { NotificationListeners } from './notification.listeners';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationListeners],
  exports: [NotificationsService],
})
export class NotificationsModule {}
