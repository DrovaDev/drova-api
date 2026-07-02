import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auth } from 'src/api/authentication/schemas/auth.schema';
import { Wallet } from 'src/api/wallets/schemas/wallet.schema';
import { WalletOwnerType, WalletProvider, WalletStatus } from 'src/constants';
import { Business } from './schemas/business.schema';

@Injectable()
export class BusinessDb {
  constructor(
    @InjectRepository(Business)
    private readonly businessModel: Repository<Business>,
  ) {}

  findById(businessId: string): Promise<Business | null> {
    return this.businessModel.findOne({
      where: { id: businessId },
      select: [
        'id',
        'businessName',
        'businessState',
        'location',
        'deliveryScope',
        'authId',
        'operatingHours',
      ],
    });
  }

  findBusinessByAuthId(authId: string): Promise<Business | null> {
    return this.businessModel.findOne({
      where: {
        authId,
      },
    });
  }

  findBusinessByTinOrRegistrationNumber(opts: {
    taxIdentificationNumber?: string;
    businessRegistrationNumber?: string;
    excludeAuthId?: string;
  }): Promise<Business | null> {
    const {
      taxIdentificationNumber,
      businessRegistrationNumber,
      excludeAuthId,
    } = opts;
    const qb = this.businessModel.createQueryBuilder('business');

    if (taxIdentificationNumber && businessRegistrationNumber) {
      qb.where(
        '(business.taxIdentificationNumber = :tin OR business.businessRegistrationNumber = :rc)',
        { tin: taxIdentificationNumber, rc: businessRegistrationNumber },
      );
    } else if (taxIdentificationNumber) {
      qb.where('business.taxIdentificationNumber = :tin', {
        tin: taxIdentificationNumber,
      });
    } else if (businessRegistrationNumber) {
      qb.where('business.businessRegistrationNumber = :rc', {
        rc: businessRegistrationNumber,
      });
    } else {
      return Promise.resolve(null);
    }

    if (excludeAuthId) {
      qb.andWhere('business.authId != :excludeAuthId', { excludeAuthId });
    }

    return qb.getOne();
  }

  private async ensureUniqueSlug(opts: {
    baseSlug: string;
    excludeBusinessId?: string;
    manager: any;
  }): Promise<string> {
    const { baseSlug, excludeBusinessId, manager } = opts;

    const trimmedBase = baseSlug.slice(0, 100) || 'business';
    let candidate = trimmedBase;

    for (let i = 0; i < 200; i += 1) {
      const existing = await manager.findOne(Business, {
        where: { slug: candidate },
      });

      if (!existing) return candidate;
      if (
        excludeBusinessId &&
        String(existing.id) === String(excludeBusinessId)
      ) {
        return candidate;
      }

      const suffix = `-${i + 1}`;
      const maxBaseLen = Math.max(1, 100 - suffix.length);
      candidate = `${trimmedBase.slice(0, maxBaseLen)}${suffix}`;
    }

    throw new BadRequestException('Unable to generate unique business slug');
  }

  async upsertBusinessProfileTransaction(opts: {
    authId: string;
    baseSlug: string;
    business: Partial<Business>;
  }): Promise<Business> {
    const { authId, baseSlug, business } = opts;

    return await this.businessModel.manager.transaction(async (manager) => {
      const existingBusiness = await manager.findOne(Business, {
        where: {
          authId,
        },
      });

      const slug = await this.ensureUniqueSlug({
        baseSlug,
        excludeBusinessId: existingBusiness?.id,
        manager,
      });

      const businessToSave = manager.create(Business, {
        ...existingBusiness,
        authId,
        ...business,
        slug,
      });

      const savedBusiness = await manager.save(Business, businessToSave);

      await manager.update(
        Auth,
        { id: authId },
        { hasCompletedBusinessProfile: true },
      );

      if (!existingBusiness) {
        const walletRepo = manager.getRepository(Wallet);
        await walletRepo.save(
          walletRepo.create({
            ownerType: WalletOwnerType.BUSINESS,
            ownerId: savedBusiness.id,
            provider: WalletProvider.DROVA,
            status: WalletStatus.READY,
          }),
        );
      }

      return savedBusiness;
    });
  }

  async editBusinessProfileTransaction(opts: {
    authId: string;
    businessUpdate: Partial<Business>;
  }): Promise<Business> {
    const { authId, businessUpdate } = opts;

    return await this.businessModel.manager.transaction(async (manager) => {
      const business = await manager.findOne(Business, {
        where: {
          authId,
        },
      });

      if (!business) {
        throw new Error('BUSINESS_NOT_FOUND');
      }

      const updated = manager.create(Business, {
        ...business,
        ...businessUpdate,
        businessName: business.businessName,
        slug: business.slug,
        businessRegistrationNumber: business.businessRegistrationNumber,
        taxIdentificationNumber: business.taxIdentificationNumber,
        bvn: business.bvn,
      });

      const savedBusiness = await manager.save(Business, updated);

      await manager.update(
        Auth,
        { id: authId },
        { hasCompletedBusinessProfile: true },
      );

      return savedBusiness;
    });
  }
}
