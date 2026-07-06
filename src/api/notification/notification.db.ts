import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceTokens } from './schemas/token.schema';
import { InAppNotification } from './schemas/notification.schema';

@Injectable()
export class NotificationDb {
  constructor(
    @InjectRepository(DeviceTokens)
    private readonly deviceTokensModel: Repository<DeviceTokens>,
    @InjectRepository(InAppNotification)
    private readonly inAppModel: Repository<InAppNotification>,
  ) {}

  async registerDeviceToken(opts: {
    authId: string;
    deviceId: string;
    deviceToken: string;
  }): Promise<DeviceTokens> {
    const now = new Date();

    return await this.deviceTokensModel.manager.transaction(async (manager) => {
      const repo = manager.getRepository(DeviceTokens);

      // Deactivate any previous token for this specific device
      await repo.update(
        { authId: opts.authId as any, deviceId: opts.deviceId, isActive: true },
        { isActive: false, lastSeenAt: now },
      );

      // Upsert by deviceToken uniqueness — if the same token already exists
      // (e.g. app re-registers without a token refresh), reactivate it
      const existing = await repo.findOne({
        where: { deviceToken: opts.deviceToken },
      });
      if (existing) {
        existing.authId = opts.authId;
        existing.deviceId = opts.deviceId;
        existing.isActive = true;
        existing.lastSeenAt = now;
        return await repo.save(existing);
      }

      const created = repo.create({
        authId: opts.authId,
        deviceId: opts.deviceId,
        deviceToken: opts.deviceToken,
        isActive: true,
        lastSeenAt: now,
      });
      return await repo.save(created);
    });
  }

  async deactivateDeviceToken(opts: {
    authId: string;
    deviceToken?: string;
  }): Promise<boolean> {
    const now = new Date();
    const where: Record<string, any> = { authId: opts.authId, isActive: true };
    if (opts.deviceToken) where.deviceToken = opts.deviceToken;

    const result = await this.deviceTokensModel.update(where, {
      isActive: false,
      lastSeenAt: now,
    });
    return Boolean(result.affected && result.affected > 0);
  }

  async deactivateDeviceTokensByDevice(opts: {
    authId: string;
    deviceId: string;
  }): Promise<void> {
    await this.deviceTokensModel.update(
      { authId: opts.authId as any, deviceId: opts.deviceId, isActive: true },
      { isActive: false, lastSeenAt: new Date() },
    );
  }

  async getActiveDeviceTokensByAuthId(authId: string): Promise<DeviceTokens[]> {
    return await this.deviceTokensModel.find({
      where: { authId, isActive: true },
      order: { updatedAt: 'DESC' },
    });
  }

  async getActiveDeviceTokensByAuthIds(
    authIds: string[],
  ): Promise<DeviceTokens[]> {
    if (!authIds.length) return [];
    return await this.deviceTokensModel
      .createQueryBuilder('dt')
      .where('dt."authId" IN (:...authIds)', { authIds })
      .andWhere('dt."isActive" = true')
      .orderBy('dt.updatedAt', 'DESC')
      .getMany();
  }

  // ─── In-app notifications ───────────────────────────────────────────────────

  async createInAppNotification(opts: {
    authId: string;
    type: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<InAppNotification> {
    const notification = this.inAppModel.create({
      authId: opts.authId,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      data: opts.data,
      isRead: false,
    });
    return await this.inAppModel.save(notification);
  }

  async getInAppNotifications(opts: {
    authId: string;
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ notifications: InAppNotification[]; count: number }> {
    const qb = this.inAppModel
      .createQueryBuilder('n')
      .where('n."authId" = :authId', { authId: opts.authId })
      .orderBy('n."createdAt"', 'DESC');

    if (opts.unreadOnly) {
      qb.andWhere('n."isRead" = false');
    }

    const count = await qb.getCount();
    qb.skip(opts.offset ?? 0).take(opts.limit ?? 20);
    const notifications = await qb.getMany();

    return { notifications, count };
  }

  async markAsRead(opts: { id: string; authId: string }): Promise<boolean> {
    const result = await this.inAppModel.update(
      { id: opts.id, authId: opts.authId },
      { isRead: true },
    );
    return (result.affected ?? 0) > 0;
  }

  async markAllAsRead(authId: string): Promise<number> {
    const result = await this.inAppModel.update(
      { authId, isRead: false },
      { isRead: true },
    );
    return result.affected ?? 0;
  }

  async getUnreadCount(authId: string): Promise<number> {
    return await this.inAppModel.count({ where: { authId, isRead: false } });
  }
}
