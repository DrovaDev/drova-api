import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IResponse } from 'src/interfaces/response.interface';
import { UserType, AvailabilityStatus, ReviewTargetType } from 'src/constants';
import { Helpers } from 'src/helpers/random-generator';
import { normalizePhoneNumber } from 'src/helpers/normalize-phone-number';
import { Business } from 'src/api/business/schemas/business.schema';
import { Rider } from './schemas/rider.schema';
import {
  CreateRiderProfileDTO,
  GetRidersQueryDto,
  InitiateRiderPhoneValidationDTO,
  ValidateRiderPhoneNumberOtpDTO,
  ResendRiderOtpDTO,
  UpdateRiderProfileDTO,
} from './dtos/rider.dto';
import type { Point } from 'typeorm';
import { UtilsService } from 'src/helpers/utils.service';
import { PaginationQuery } from 'src/interfaces/pagination.interface';
import { RiderDb } from './rider.db';
import { AuthenticationDb } from 'src/api/authentication/authentication.db';
import { ReviewsDb } from 'src/api/reviews/reviews.db';

@Injectable()
export class RiderService {
  constructor(
    private readonly riderDb: RiderDb,
    private readonly authDb: AuthenticationDb,
    private readonly reviewsDb: ReviewsDb,
    private readonly helpers: Helpers,
    private readonly utilService: UtilsService,
    @InjectRepository(Business)
    private readonly businessModel: Repository<Business>,
  ) {}

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private normalizePhone(phone: string): string {
    return normalizePhoneNumber(phone.trim());
  }

  private otpExpiry(): Date {
    return new Date(Date.now() + 10 * 60 * 1000);
  }

  private async generateAndSaveOtp(authId: string): Promise<string> {
    const otp = this.helpers.generateOTP(6);
    await this.authDb.upsertOtpTransaction({
      authId,
      otpCode: otp,
      expiresAt: this.otpExpiry(),
    });
    return otp;
  }

  private sendOtpSafe(phone: string, otp: string): void {
    // OTP delivery not yet configured — log for dev visibility only
    console.log(`[OTP] phone=${phone} otp=${otp}`);
  }

  private async findRiderAuthByPhone(phone: string) {
    const auth = await this.authDb.findAuthByTelephoneNumber({
      telephoneNumber: phone,
    });
    if (!auth) {
      throw new NotFoundException(
        'Rider auth record not found. Initiate validation first.',
      );
    }
    if (auth.userType !== UserType.RIDER) {
      throw new BadRequestException('Phone number is not a rider account');
    }
    return auth;
  }

  private async findRiderOrThrow(
    businessId: string,
    riderId: string,
  ): Promise<Rider> {
    const rider = await this.riderDb.findRiderById(businessId, riderId);
    if (!rider) throw new NotFoundException('Rider not found');
    return rider;
  }

  private async assertBusinessExists(businessId: string): Promise<void> {
    const business = await this.businessModel.findOne({
      where: { id: businessId },
    });
    if (!business) throw new NotFoundException('Business not found');
  }

  private assertProfileFieldsPresent(payload: CreateRiderProfileDTO): void {
    if (!payload?.firstName || !payload?.lastName || !payload?.vehicleType) {
      throw new BadRequestException(
        'firstName, lastName and vehicleType are required',
      );
    }
  }

  private validateOtpOrThrow(
    otpRecord: { isUsed: boolean; expiresAt: Date; otpCode: string },
    otp: string,
  ): void {
    if (otpRecord.isUsed)
      throw new BadRequestException('OTP has already been used');
    if (otpRecord.expiresAt < new Date())
      throw new BadRequestException('OTP has expired');
    const isDev = process.env.NODE_ENV === 'development';
    const matches =
      isDev && otp === '000000' ? true : otpRecord.otpCode === otp;
    if (!matches) throw new BadRequestException('Invalid OTP');
  }

  private buildRiderData(
    authId: string,
    businessId: string | undefined,
    payload: CreateRiderProfileDTO,
    fallbackPhone: string,
  ): Partial<Rider> {
    return {
      authId,
      businessId,
      ...payload,
      phoneNumber: payload.phoneNumber
        ? this.normalizePhone(payload.phoneNumber)
        : fallbackPhone,
    };
  }

  private applyProfileUpdate(
    existing: Rider,
    payload: UpdateRiderProfileDTO,
  ): Rider {
    return this.riderDb.createRider({
      ...existing,
      ...payload,
      phoneNumber: payload.phoneNumber
        ? this.normalizePhone(payload.phoneNumber)
        : existing.phoneNumber,
    });
  }

  // ---------------------------------------------------------------------------
  // Public methods
  // ---------------------------------------------------------------------------

  async initiateRiderPhoneNumberValidation(
    businessId: string,
    payload: InitiateRiderPhoneValidationDTO,
  ): Promise<IResponse> {
    if (!businessId) throw new BadRequestException('businessId is required');
    if (!payload?.telephoneNumber) {
      throw new BadRequestException('telephoneNumber is required');
    }

    const normalizedPhone = this.normalizePhone(payload.telephoneNumber);

    await this.assertBusinessExists(businessId);

    const existingAuth = await this.authDb.findAuthByTelephoneNumber({
      telephoneNumber: normalizedPhone,
    });

    if (existingAuth && existingAuth.userType !== UserType.RIDER) {
      throw new BadRequestException(
        'Phone number is already in use by a non-rider account',
      );
    }

    let auth = existingAuth;
    auth ??= await this.authDb.createAuthWithOtpTransaction({
      auth: {
        telephoneNumber: normalizedPhone,
        userType: UserType.RIDER,
        isActive: false,
        isVerified: false,
      },
      otpCode: this.helpers.generateOTP(6),
      otpExpiresAt: this.otpExpiry(),
    });

    const otp = await this.generateAndSaveOtp(auth.id);
    this.sendOtpSafe(normalizedPhone, otp);

    // Create a partial rider record tied to this business so the rider is
    // associated even before their full profile is completed.
    const existingRider = await this.riderDb.findRiderByAuthId(auth.id);
    if (!existingRider) {
      await this.riderDb.createRiderProfileWithPerformanceTransaction({
        rider: { authId: auth.id, businessId, phoneNumber: normalizedPhone },
        performance: {},
      });
    }

    return {
      status: 'success',
      statusCode: 200,
      message: 'OTP sent to rider phone number',
      data: { telephoneNumber: normalizedPhone, authId: auth.id },
    };
  }

  async resendRiderOtp(
    payload: ResendRiderOtpDTO,
  ): Promise<IResponse> {
    if (!payload?.telephoneNumber) {
      throw new BadRequestException('telephoneNumber is required');
    }

    const normalizedPhone = this.normalizePhone(payload.telephoneNumber);
    const auth = await this.findRiderAuthByPhone(normalizedPhone);

    if (auth.isVerified && auth.isActive) {
      throw new BadRequestException('Phone number is already verified');
    }

    const otp = await this.generateAndSaveOtp(auth.id);
    this.sendOtpSafe(normalizedPhone, otp);

    return {
      status: 'success',
      statusCode: 200,
      message: 'OTP resent successfully.',
      data: { telephoneNumber: normalizedPhone, authId: auth.id },
    };
  }

  async validateRiderOtp(
    payload: ValidateRiderPhoneNumberOtpDTO,
  ): Promise<IResponse> {
    if (!payload?.telephoneNumber) {
      throw new BadRequestException('telephoneNumber is required');
    }
    if (!payload?.otp) throw new BadRequestException('otp is required');

    const normalizedPhone = this.normalizePhone(payload.telephoneNumber);
    const auth = await this.findRiderAuthByPhone(normalizedPhone);

    const otpRecord = await this.authDb.findOtpByAuthId(auth.id);
    if (!otpRecord) {
      throw new NotFoundException('OTP not found. Please request a new one.');
    }
    this.validateOtpOrThrow(otpRecord, payload.otp);

    await this.authDb.verifyAuthEmailTransaction({
      authId: auth.id,
      otpId: String(otpRecord.id),
    });

    return {
      status: 'success',
      statusCode: 200,
      message: 'OTP validated successfully.',
      data: { authId: auth.id, telephoneNumber: normalizedPhone },
    };
  }

  async createRiderProfile(
    businessId: string,
    phoneNumber: string,
    payload: CreateRiderProfileDTO,
  ): Promise<IResponse> {
    if (!businessId) throw new BadRequestException('businessId is required');
    if (!phoneNumber)
      throw new BadRequestException('phoneNumber is required');
    this.assertProfileFieldsPresent(payload);

    const normalizedPhone = this.normalizePhone(phoneNumber);

    await this.assertBusinessExists(businessId);

    const auth = await this.authDb.findAuthByTelephoneNumber({
      telephoneNumber: normalizedPhone,
    });
    if (!auth) {
      throw new NotFoundException(
        'Auth record not found for this phone number. Validate OTP first.',
      );
    }
    if (auth.userType !== UserType.RIDER) {
      throw new BadRequestException('Auth record is not a rider account');
    }
    if (!auth.isVerified || !auth.isActive) {
      throw new BadRequestException(
        'Rider phone number has not been validated yet',
      );
    }

    const existingRider = await this.riderDb.findRiderByAuthId(auth.id);

    if (existingRider?.firstName) {
      throw new BadRequestException('Rider profile already exists');
    }

    if (existingRider) {
      // Partial record exists (created at initiation) — fill in the full profile.
      const saved = await this.riderDb.saveRider(
        this.riderDb.createRider({
          ...existingRider,
          ...payload,
          phoneNumber: payload.phoneNumber
            ? this.normalizePhone(payload.phoneNumber)
            : normalizedPhone,
        }),
      );
      return {
        status: 'success',
        statusCode: 201,
        message: 'Rider profile created successfully',
        data: saved,
      };
    }

    const rider = await this.riderDb.createRiderProfileWithPerformanceTransaction({
      rider: this.buildRiderData(auth.id, businessId, payload, normalizedPhone),
      performance: {},
    });

    return {
      status: 'success',
      statusCode: 201,
      message: 'Rider profile created successfully',
      data: rider,
    };
  }

  async createRiderSelfProfile(
    riderAuthId: string,
    businessId: string,
    payload: CreateRiderProfileDTO,
  ): Promise<IResponse> {
    this.assertProfileFieldsPresent(payload);

    await this.assertBusinessExists(businessId);

    const auth = await this.authDb.findAuthById(riderAuthId);
    if (!auth) throw new NotFoundException('Auth record not found');
    if (auth.userType !== UserType.RIDER) {
      throw new BadRequestException('Auth record is not a rider account');
    }
    if (!auth.isVerified || !auth.isActive) {
      throw new BadRequestException('Rider account has not been validated yet');
    }

    const existingRider = await this.riderDb.findRiderByAuthId(riderAuthId);

    if (existingRider?.firstName) {
      throw new BadRequestException('Rider profile already exists');
    }

    const fallbackPhone = this.normalizePhone(auth.telephoneNumber!);

    if (existingRider) {
      // Partial record exists — fill in the full profile.
      const saved = await this.riderDb.saveRider(
        this.riderDb.createRider({
          ...existingRider,
          ...payload,
          phoneNumber: payload.phoneNumber
            ? this.normalizePhone(payload.phoneNumber)
            : fallbackPhone,
        }),
      );
      return {
        status: 'success',
        statusCode: 201,
        message: 'Rider profile created successfully',
        data: saved,
      };
    }

    const rider = await this.riderDb.createRiderProfileWithPerformanceTransaction({
      rider: this.buildRiderData(riderAuthId, businessId, payload, fallbackPhone),
      performance: {},
    });

    return {
      status: 'success',
      statusCode: 201,
      message: 'Rider profile created successfully',
      data: rider,
    };
  }

  async getAllRiders(
    businessId: string,
    query: GetRidersQueryDto,
  ): Promise<IResponse> {
    const paginationParams: PaginationQuery = {
      page: query.page || 1,
      limit: query.limit || 10,
    };
    const sortBy = query?.sortBy ? String(query.sortBy) : 'createdAt';
    const sortOrder = query?.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const allowedSortFields = new Set([
      'createdAt',
      'updatedAt',
      'firstName',
      'lastName',
      'phoneNumber',
      'status',
      'inviteStatus',
      'availabilityStatus',
    ]);
    const resolvedSortBy = allowedSortFields.has(sortBy) ? sortBy : 'createdAt';

    const filterParams = {
      businessId,
      search: query?.search,
      availabilityStatus: query?.availabilityStatus,
      inviteStatus: query?.inviteStatus,
      status: query?.status,
      startDate: (query as any).startDate,
      endDate: (query as any).endDate,
      sortBy: resolvedSortBy,
      sortOrder: sortOrder as 'ASC' | 'DESC',
    };

    const page = paginationParams.page || 1;
    const limit = paginationParams.limit || 20;
    const offset = (page - 1) * limit;

    const { riders, count } = await this.riderDb.listRiders({
      ...filterParams,
      offset,
      limit,
    });

    const meta = {
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: paginationParams.page,
      limit: paginationParams.limit,
    };

    return {
      status: 'success',
      statusCode: 200,
      message: riders.length
        ? 'Riders fetched successfully'
        : 'No riders found',
      data: riders,
      meta
    };
  }

  async getMyRiderProfile(riderAuthId: string): Promise<IResponse> {
    const rider = await this.riderDb.findRiderByAuthId(riderAuthId);
    if (!rider) throw new NotFoundException('Rider profile not found');

    const averageRating = await this.reviewsDb.getAverageRating(rider.id, ReviewTargetType.RIDER);

    return {
      status: 'success',
      statusCode: 200,
      message: 'Rider profile fetched successfully',
      data: { ...rider, averageRating },
    };
  }

  async getRiderById(
    businessId: string,
    riderId: string,
  ): Promise<IResponse> {
    if (!riderId) throw new BadRequestException('riderId is required');
    if (!businessId) throw new BadRequestException('businessId is required');

    const rider = await this.findRiderOrThrow(businessId, riderId);
    const averageRating = await this.reviewsDb.getAverageRating(rider.id, ReviewTargetType.RIDER);

    return {
      status: 'success',
      statusCode: 200,
      message: 'Rider fetched successfully',
      data: { ...rider, averageRating },
    };
  }

  async updateRiderProfile(
    riderId: string | undefined,
    businessId: string | undefined,
    payload: UpdateRiderProfileDTO,
    riderAuthId?: string,
  ): Promise<IResponse> {
    if (!payload || Object.keys(payload).length === 0) {
      throw new BadRequestException('payload is required');
    }

    if (riderAuthId) {
      const existing = await this.riderDb.findRiderByAuthId(riderAuthId);

      if (existing) {
        const saved = await this.riderDb.saveRider(
          this.applyProfileUpdate(existing, payload),
        );
        return {
          status: 'success',
          statusCode: 200,
          message: 'Rider profile updated successfully',
          data: saved,
        };
      }

      const created =
        await this.riderDb.createRiderProfileWithPerformanceTransaction({
          rider: {
            authId: riderAuthId,
            businessId,
            ...payload,
            phoneNumber: payload.phoneNumber
              ? this.normalizePhone(payload.phoneNumber)
              : undefined,
          },
          performance: {},
        });
      return {
        status: 'success',
        statusCode: 201,
        message: 'Rider profile created successfully',
        data: created,
      };
    }

    if (!riderId) throw new BadRequestException('riderId is required');

    const rider = await this.findRiderOrThrow(businessId!, riderId);
    const saved = await this.riderDb.saveRider(
      this.applyProfileUpdate(rider, payload),
    );

    return {
      status: 'success',
      statusCode: 200,
      message: 'Rider profile updated successfully',
      data: saved,
    };
  }

  async deleteRider(
    businessId: string,
    riderId: string,
  ): Promise<IResponse> {
    if (!riderId) throw new BadRequestException('riderId is required');

    const rider = await this.findRiderOrThrow(businessId, riderId);
    rider.isDeleted = true;
    const saved = await this.riderDb.saveRider(rider);

    return {
      status: 'success',
      statusCode: 200,
      message: 'Rider deleted successfully',
      data: saved,
    };
  }

  async updateRiderAvailabilityStatus(
    businessId: string,
    riderId: string,
    availabilityStatus: AvailabilityStatus,
  ): Promise<IResponse> {
    if (!businessId) throw new BadRequestException('businessId is required');
    if (!riderId) throw new BadRequestException('riderId is required');

    const rider = await this.findRiderOrThrow(businessId, riderId);
    rider.availabilityStatus = availabilityStatus;
    const saved = await this.riderDb.saveRider(rider);

    return {
      status: 'success',
      statusCode: 200,
      message: 'Rider availability status updated successfully',
      data: saved,
    };
  }

  async updateRiderLocation(
    businessId: string,
    riderId: string,
    latitude: number,
    longitude: number,
  ): Promise<IResponse> {
    if (!businessId) throw new BadRequestException('businessId is required');
    if (!riderId) throw new BadRequestException('riderId is required');
    if (latitude === undefined || latitude === null) {
      throw new BadRequestException('latitude is required');
    }
    if (longitude === undefined || longitude === null) {
      throw new BadRequestException('longitude is required');
    }

    const rider = await this.findRiderOrThrow(businessId, riderId);

    const location: Point = {
      type: 'Point',
      coordinates: [longitude, latitude],
    };

    rider.lastKnownLocation = location;
    rider.lastLocationUpdatedAt = new Date();
    const saved = await this.riderDb.saveRider(rider);

    return {
      status: 'success',
      statusCode: 200,
      message: 'Rider location updated successfully',
      data: saved,
    };
  }
}
