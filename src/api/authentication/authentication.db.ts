import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auth } from './schemas/auth.schema';
import { Otp } from './schemas/otp.schema';
import { UserType } from 'src/constants';

@Injectable()
export class AuthenticationDb {
  constructor(
    @InjectRepository(Auth)
    private readonly authModel: Repository<Auth>,
    @InjectRepository(Otp)
    private readonly otpModel: Repository<Otp>,
  ) {}

  findAuthById(authId: string): Promise<Auth | null> {
    return this.authModel.findOne({
      where: {
        id: authId,
        isDeleted: false,
      },
    });
  }

  findAuthByEmail(opts: {
    email: string;
    userType?: UserType;
  }): Promise<Auth | null> {
    const { email, userType } = opts;
    return this.authModel.findOne({
      where: {
        email,
        isDeleted: false,
        ...(userType ? { userType } : {}),
      },
    });
  }

  findAuthByTelephoneNumber(opts: {
    telephoneNumber: string;
    userType?: UserType;
  }): Promise<Auth | null> {
    const { telephoneNumber, userType } = opts;
    return this.authModel.findOne({
      where: {
        telephoneNumber,
        isDeleted: false,
        ...(userType ? { userType } : {}),
      },
    });
  }

  findOtpByAuthId(authId: string): Promise<Otp | null> {
    return this.otpModel.findOne({
      where: {
        authId,
      },
    });
  }

  async upsertOtpTransaction(opts: {
    authId: string;
    otpCode: string;
    expiresAt: Date;
    isUsed?: boolean;
  }): Promise<Otp> {
    const { authId, otpCode, expiresAt, isUsed } = opts;

    return await this.otpModel.manager.transaction(async (manager) => {
      const otpRepo = manager.getRepository(Otp);

      let otp = await otpRepo.findOne({ where: { authId } });
      if (otp) {
        otp.otpCode = otpCode;
        otp.expiresAt = expiresAt;
        otp.isUsed = isUsed ?? false;
      } else {
        otp = otpRepo.create({
          authId,
          otpCode,
          expiresAt,
          isUsed: isUsed ?? false,
        });
      }

      return await otpRepo.save(otp);
    });
  }

  async createAuthWithOtpTransaction(opts: {
    auth: Partial<Auth>;
    otpCode: string;
    otpExpiresAt: Date;
  }): Promise<Auth> {
    const { auth, otpCode, otpExpiresAt } = opts;

    return await this.authModel.manager.transaction(async (manager) => {
      const authRepo = manager.getRepository(Auth);
      const otpRepo = manager.getRepository(Otp);

      const createdAuth = await authRepo.save(authRepo.create(auth));

      let otpRecord = await otpRepo.findOne({
        where: {
          authId: createdAuth.id,
        },
      });

      if (otpRecord) {
        otpRecord.otpCode = otpCode;
        otpRecord.expiresAt = otpExpiresAt;
        otpRecord.isUsed = false;
      } else {
        otpRecord = otpRepo.create({
          authId: createdAuth.id,
          otpCode,
          expiresAt: otpExpiresAt,
          isUsed: false,
        });
      }

      await otpRepo.save(otpRecord);

      return createdAuth;
    });
  }

  async verifyAuthEmailTransaction(opts: {
    authId: string;
    otpId: string;
  }): Promise<void> {
    const { authId, otpId } = opts;

    await this.authModel.manager.transaction(async (manager) => {
      const authRepo = manager.getRepository(Auth);
      const otpRepo = manager.getRepository(Otp);

      const otp = await otpRepo.findOne({ where: { id: otpId as any } });
      if (otp) {
        otp.isUsed = true;
        await otpRepo.save(otp);
      }

      await authRepo.update(
        { id: authId as any },
        {
          isVerified: true,
          isActive: true,
        },
      );
    });
  }

  async activateAuthWithNewPasswordTransaction(opts: {
    authId: string;
    otpId: string;
    hashedPassword: string;
  }): Promise<void> {
    const { authId, otpId, hashedPassword } = opts;

    await this.authModel.manager.transaction(async (manager) => {
      const authRepo = manager.getRepository(Auth);
      const otpRepo = manager.getRepository(Otp);

      const otpRecord = await otpRepo.findOne({ where: { id: otpId as any } });
      if (otpRecord) {
        otpRecord.isUsed = true;
        await otpRepo.save(otpRecord);
      }

      const auth = await authRepo.findOne({ where: { id: authId as any } });
      if (auth) {
        auth.password = hashedPassword;
        auth.isVerified = true;
        auth.isActive = true;
        await authRepo.save(auth);
      }
    });
  }

  async markOtpUsedTransaction(otpId: string): Promise<void> {
    await this.otpModel.manager.transaction(async (manager) => {
      const otpRepo = manager.getRepository(Otp);
      await otpRepo.update({ id: otpId as any }, { isUsed: true });
    });
  }

  async updateAuthPasswordTransaction(opts: {
    authId: string;
    hashedPassword: string;
  }): Promise<void> {
    const { authId, hashedPassword } = opts;

    await this.authModel.manager.transaction(async (manager) => {
      const authRepo = manager.getRepository(Auth);
      await authRepo.update(
        { id: authId as any },
        { password: hashedPassword },
      );
    });
  }

}
