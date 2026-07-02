import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

@Injectable()
export class PushNotificationService {
  private readonly expo = new Expo();
  private readonly logger = new Logger(PushNotificationService.name);

  async sendNotification(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    await this.sendMulticastNotification([token], title, body, data);
  }

  async sendMulticastNotification(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    const validTokens = tokens.filter((t) => {
      const ok = Expo.isExpoPushToken(t);
      if (!ok) this.logger.warn(`Skipping invalid Expo push token: ${t}`);
      return ok;
    });

    if (!validTokens.length) return;

    const messages: ExpoPushMessage[] = validTokens.map((to) => ({
      to,
      title,
      body,
      data: data ?? {},
      sound: 'default',
    }));

    const chunks = this.expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      let tickets: ExpoPushTicket[];
      try {
        tickets = await this.expo.sendPushNotificationsAsync(chunk);
      } catch (err) {
        this.logger.error('Failed to send push notification chunk', err);
        continue;
      }

      for (const ticket of tickets) {
        if (ticket.status === 'error') {
          this.logger.error(
            `Push notification error: ${ticket.message}`,
            ticket.details,
          );
        }
      }

      this.logger.log(
        `Sent ${tickets.filter((t) => t.status === 'ok').length}/${tickets.length} notifications successfully`,
      );
    }
  }
}
