import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Rider } from './schemas/rider.schema';
import { RiderPerformance } from './schemas/performance.schema';
import { Wallet } from 'src/api/wallets/schemas/wallet.schema';
import {
  InviteStatus,
  RiderStatus,
  WalletOwnerType,
  WalletProvider,
  WalletStatus,
} from 'src/constants';

@Injectable()
export class RiderDb {
  constructor(
    @InjectRepository(Rider)
    private readonly riderModel: Repository<Rider>,
  ) {}

  findRiderByAuthId(authId: string): Promise<Rider | null> {
    return this.riderModel.findOne({ where: { authId, isDeleted: false } });
  }

  findRiderById(businessId: string, riderId: string): Promise<Rider | null> {
    return this.riderModel.findOne({
      where: { id: riderId, businessId, isDeleted: false },
    });
  }

  findRiderByRiderId(riderId: string): Promise<Rider | null> {
    return this.riderModel.findOne({
      where: { id: riderId as any, isDeleted: false },
    });
  }

  createRider(data: Partial<Rider>): Rider {
    return this.riderModel.create(data);
  }

  async saveRider(rider: Rider): Promise<Rider> {
    return this.riderModel.save(rider);
  }

  async saveRiderSession(opts: {
    riderId: string;
    activeDeviceId: string;
    sessionId: string;
  }): Promise<void> {
    await this.riderModel.update(
      { id: opts.riderId as any },
      { activeDeviceId: opts.activeDeviceId, sessionId: opts.sessionId },
    );
  }

  async clearRiderSession(riderId: string): Promise<void> {
    await this.riderModel.update(
      { id: riderId as any },
      { activeDeviceId: undefined, sessionId: undefined },
    );
  }

  async setRiderHasChangedPasswordTransaction(authId: string): Promise<void> {
    await this.riderModel.manager.transaction(async (manager) => {
      const riderRepo = manager.getRepository(Rider);
      await riderRepo.update(
        { authId: authId as any, isDeleted: false },
        { hasChangedPassword: true },
      );
    });
  }

  async updateRiderAfterLoginIfPendingTransaction(opts: {
    riderId: string;
  }): Promise<void> {
    const { riderId } = opts;
    await this.riderModel.manager.transaction(async (manager) => {
      const repo = manager.getRepository(Rider);
      const rider = await repo.findOne({ where: { id: riderId as any } });
      if (!rider) return;

      const shouldAcceptInvite = rider.inviteStatus === InviteStatus.PENDING;
      const shouldActivate = rider.status === RiderStatus.PENDING;
      if (!shouldAcceptInvite && !shouldActivate) return;

      rider.inviteStatus = InviteStatus.ACCEPTED;
      rider.status = RiderStatus.ACTIVE;
      await repo.save(rider);
    });
  }

  createRiderQueryBuilder(businessId: string): SelectQueryBuilder<Rider> {
    return this.riderModel
      .createQueryBuilder('rider')
      .where(
        'rider.isDeleted = :isDeleted AND rider.businessId = :businessId',
        {
          isDeleted: false,
          businessId,
        },
      );
  }

  async listRiders(opts: {
    businessId: string;
    search?: string;
    availabilityStatus?: string;
    inviteStatus?: string;
    status?: string;
    startDate?: any;
    endDate?: any;
    offset: number;
    limit: number;
    sortBy: string;
    sortOrder: 'ASC' | 'DESC';
  }): Promise<{ riders: Rider[]; count: number }> {
    const {
      businessId,
      search,
      availabilityStatus,
      inviteStatus,
      status,
      startDate,
      endDate,
      offset,
      limit,
      sortBy,
      sortOrder,
    } = opts;

    const qb = this.createRiderQueryBuilder(businessId);

    if (search) {
      const s = `%${String(search).trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(rider.firstName) LIKE :s OR LOWER(rider.lastName) LIKE :s OR LOWER(rider.phoneNumber) LIKE :s)',
        { s },
      );
    }
    if (availabilityStatus) {
      qb.andWhere('rider.availabilityStatus = :availabilityStatus', {
        availabilityStatus,
      });
    }
    if (inviteStatus) {
      qb.andWhere('rider.inviteStatus = :inviteStatus', { inviteStatus });
    }
    if (status) {
      qb.andWhere('rider.status = :status', { status });
    }
    if (startDate && endDate) {
      qb.andWhere(
        'rider.createdAt >= :startDate AND rider.createdAt <= :endDate',
        {
          startDate,
          endDate,
        },
      );
    } else if (startDate) {
      qb.andWhere('rider.createdAt >= :startDate', { startDate });
    }

    const count = await qb.getCount();

    qb.orderBy(`rider.${sortBy}`, sortOrder).skip(offset).take(limit);
    const riders = await qb.leftJoinAndSelect('rider.auth', 'auth').getMany();

    return { riders, count };
  }

  async createRiderProfileWithPerformanceTransaction(opts: {
    rider: Partial<Rider>;
    performance: Partial<RiderPerformance>;
  }): Promise<Rider> {
    const { rider, performance } = opts;

    return this.riderModel.manager.transaction(async (manager) => {
      const riderRepo = manager.getRepository(Rider);
      const perfRepo = manager.getRepository(RiderPerformance);
      const walletRepo = manager.getRepository(Wallet);

      const savedRider = await riderRepo.save(riderRepo.create(rider));
      await perfRepo.save(
        perfRepo.create({ ...performance, riderId: savedRider.id }),
      );
      await walletRepo.save(
        walletRepo.create({
          ownerType: WalletOwnerType.RIDER,
          ownerId: savedRider.id,
          provider: WalletProvider.DROVA,
          status: WalletStatus.READY,
        }),
      );

      return savedRider;
    });
  }
}
