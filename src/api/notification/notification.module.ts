import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationDb } from './notification.db';
import { DeviceTokens } from './schemas/token.schema';
import { InAppNotification } from './schemas/notification.schema';
import { PushNotificationService } from 'src/services/push-notification.service';

@Module({
  imports: [TypeOrmModule.forFeature([DeviceTokens, InAppNotification])],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationDb, PushNotificationService],
  exports: [NotificationService, NotificationDb],
})
export class NotificationModule {}
