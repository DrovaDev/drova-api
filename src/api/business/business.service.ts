import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { IResponse } from 'src/interfaces/response.interface';
import { BusinessValidationService } from 'src/services/business-validation.service';
import {
  UserType,
  NigerianState,
  DeliveryScope,
  SubscriptionPlan,
  BusinessDayOfWeek,
  BusinessOperatingStatus,
} from 'src/constants';
import {
  BusinessProfileSetupDTO,
  EditBusinessProfileDTO,
  ValidateBusinessTinDTO,
} from './dtos/business.dto';
import { BusinessDb } from './business.db';
import { AuthenticationDb } from '../authentication/authentication.db';
import { JwtService } from '@nestjs/jwt';
import { ReviewsService } from '../reviews/reviews.service';
import { ReviewTargetType } from 'src/constants';
import { ReviewQueryDTO } from '../reviews/dtos/review.dto';

@Injectable()
export class BusinessService {
  constructor(
    private readonly businessDb: BusinessDb,
    private readonly authDb: AuthenticationDb,
    private readonly businessValidationService: BusinessValidationService,
    private readonly jwtService: JwtService,
    private readonly reviewsService: ReviewsService,
  ) {}

  private normalizeOperatingHours(input: any) {
    if (!Array.isArray(input)) return input;
    return input.map((h) => ({
      ...h,
      opensAt: h?.opensAt ?? null,
      closesAt: h?.closesAt ?? null,
    }));
  }

  private normalizeBusinessName(input: string): string {
    return input.toUpperCase().replace(/\s+/g, ' ').replace(/[.,]/g, '').trim();
  }

  private normalizeTin(input: string): string {
    return input.replace(/\D+/g, '').trim();
  }

  private createBaseSlug(input: string): string {
    const slug = input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .replace(/-{2,}/g, '-');

    return slug.slice(0, 100) || 'business';
  }

  async getMyBusinessProfile(authId: string): Promise<IResponse> {
    const business = await this.businessDb.findBusinessByAuthId(authId);
    if (!business) throw new NotFoundException('Business profile not found');

    return {
      status: 'success',
      statusCode: 200,
      message: 'Business profile fetched successfully',
      data: business,
    };
  }

  async validateBusinessNameAndTin(
    payload: ValidateBusinessTinDTO,
  ): Promise<IResponse> {
    const {
      businessRegistrationNumber,
      businessName,
      taxIdentificationNumber,
    } = payload;

    const existing =
      await this.businessDb.findBusinessByTinOrRegistrationNumber({
        taxIdentificationNumber,
        businessRegistrationNumber,
      });
    if (existing) {
      if (existing.taxIdentificationNumber === taxIdentificationNumber) {
        throw new BadRequestException(
          'A business with this tax identification number is already registered',
        );
      }
      throw new BadRequestException(
        'A business with this registration number is already registered',
      );
    }

    if (process.env.NODE_ENV === 'development') {
      // Automatically validate business
      return {
        status: 'success',
        statusCode: 200,
        message: 'Business verification successful (development mode)',
        data: {
          isValid: true,
          matches: {
            businessName: true,
            taxIdentificationNumber: true,
            businessRegistrationNumber: true,
          },
          reference: null,
          upstreamStatus: 'success',
        },
      };
    }

    const upstream = await this.businessValidationService.lookupBusinessTIN(
      businessRegistrationNumber,
    );

    const upstreamCompanyName = String(
      upstream?.data?.company_name ?? '',
    ).trim();
    const upstreamTin = String(upstream?.data?.tax_id ?? '').trim();
    const upstreamRc = String(upstream?.data?.rc ?? '').trim();

    const normalizedProvidedName = this.normalizeBusinessName(businessName);
    const normalizedUpstreamName =
      this.normalizeBusinessName(upstreamCompanyName);
    const nameMatches =
      normalizedProvidedName.length > 0 &&
      normalizedUpstreamName.length > 0 &&
      normalizedProvidedName === normalizedUpstreamName;

    const normalizedProvidedTin = this.normalizeTin(taxIdentificationNumber);
    const normalizedUpstreamTin = this.normalizeTin(upstreamTin);
    const tinMatches =
      normalizedProvidedTin.length > 0 &&
      normalizedUpstreamTin.length > 0 &&
      normalizedProvidedTin === normalizedUpstreamTin;

    const rcMatches =
      this.normalizeTin(businessRegistrationNumber) ===
      this.normalizeTin(upstreamRc);

    const isValid = nameMatches && tinMatches && rcMatches;

    return {
      status: 'success',
      statusCode: 200,
      message: isValid
        ? 'Business verification successful'
        : 'Business verification failed',
      data: {
        isValid,
        matches: {
          businessName: nameMatches,
          taxIdentificationNumber: tinMatches,
          businessRegistrationNumber: rcMatches,
        },
        reference: upstream?.reference,
        upstreamStatus: upstream?.status,
      },
    };
  }

  private enumToOptions<T extends Record<string, string>>(
    enumObject: T,
  ): Array<{
    key: keyof T;
    value: T[keyof T];
  }> {
    return Object.entries(enumObject)
      .map(([key, value]) => ({
        key: key,
        value: value as T[keyof T],
      }))
      .sort((a, b) => String(a.value).localeCompare(String(b.value)));
  }

  async setupBusinessProfile(
    authId: string,
    payload: BusinessProfileSetupDTO,
  ): Promise<IResponse> {
    const {
      businessName,
      businessDescription,
      businessAddress,
      businessState,
      location,
      deliveryScope,
      fleetSize,
      businessRegistrationNumber,
      taxIdentificationNumber,
      bvn,
      contactNumber,
      businessLogo,
      coverImage,
      operatingHours,
    } = payload;

    if (!authId) {
      throw new BadRequestException('authId is required');
    }

    if (
      !businessName ||
      !businessAddress ||
      !businessState ||
      !location ||
      !contactNumber
    ) {
      throw new BadRequestException('Missing required business profile fields');
    }
    if (!deliveryScope?.length) {
      throw new BadRequestException('deliveryScope is required');
    }

    try {
      const user = await this.authDb.findAuthById(authId);

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.userType !== UserType.BUSINESS) {
        throw new BadRequestException(
          'Only business accounts can setup a business profile',
        );
      }

      const baseSlug = this.createBaseSlug(businessName);

      const normalizedOperatingHours =
        this.normalizeOperatingHours(operatingHours);

      const isBusinessVerified = process.env.NODE_ENV === 'development';

      const savedBusiness =
        await this.businessDb.upsertBusinessProfileTransaction({
          authId: user.id,
          baseSlug,
          business: {
            businessName,
            businessDescription,
            businessAddress,
            businessState,
            location,
            deliveryScope,
            fleetSize: fleetSize ?? 0,
            businessRegistrationNumber,
            taxIdentificationNumber,
            bvn,
            contactNumber,
            businessLogo,
            coverImage,
            operatingHours: normalizedOperatingHours,
            isVerified: isBusinessVerified,
          },
        });

      return {
        status: 'success',
        statusCode: 200,
        message: 'Business profile setup successful',
        data: {
          id: savedBusiness.id,
          businessName: savedBusiness.businessName,
          slug: savedBusiness.slug,
          isVerified: savedBusiness.isVerified,
        },
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to setup business profile',
      );
    }
  }

  async editBusinessProfile(
    authId: string,
    payload: EditBusinessProfileDTO,
  ): Promise<IResponse> {
    if (!authId) {
      throw new BadRequestException('authId is required');
    }

    try {
      const user = await this.authDb.findAuthById(authId);

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.userType !== UserType.BUSINESS) {
        throw new BadRequestException(
          'Only business accounts can edit a business profile',
        );
      }

      const business = await this.businessDb.findBusinessByAuthId(user.id);

      if (!business) {
        throw new NotFoundException('Business profile not found');
      }

      this.assertImmutableBusinessFields(payload as any, business);

      const savedBusiness =
        await this.businessDb.editBusinessProfileTransaction({
          authId: user.id,
          businessUpdate: {
            businessDescription:
              payload.businessDescription ?? business.businessDescription,
            businessAddress:
              payload.businessAddress ?? business.businessAddress,
            businessState:
              (payload.businessState as any) ?? business.businessState,
            location: (payload.location as any) ?? business.location,
            deliveryScope:
              (payload.deliveryScope as any) ?? business.deliveryScope,
            fleetSize: payload.fleetSize ?? business.fleetSize,
            contactNumber: payload.contactNumber ?? business.contactNumber,
            businessLogo: payload.businessLogo ?? business.businessLogo,
            coverImage: payload.coverImage ?? business.coverImage,
            operatingHours:
              payload.operatingHours === undefined
                ? business.operatingHours
                : this.normalizeOperatingHours(payload.operatingHours),
            bvn: payload.bvn ?? business.bvn,
          },
        });

      return {
        status: 'success',
        statusCode: 200,
        message: 'Business profile updated successfully',
        data: {
          id: savedBusiness.id,
          businessName: savedBusiness.businessName,
          slug: savedBusiness.slug,
          isVerified: savedBusiness.isVerified,
        },
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to edit business profile');
    }
  }

  getNigerianStates(): IResponse {
    return {
      status: 'success',
      statusCode: 200,
      message: 'Nigerian states fetched successfully',
      data: this.enumToOptions(NigerianState),
    };
  }

  private assertImmutableBusinessFields(
    payload: Record<string, unknown>,
    business: {
      businessName: string;
      businessRegistrationNumber?: string;
      taxIdentificationNumber?: string;
    },
  ): void {
    if (
      payload.businessName !== undefined &&
      payload.businessName !== business.businessName
    ) {
      throw new BadRequestException('businessName cannot be updated');
    }
    if (
      payload.businessRegistrationNumber !== undefined &&
      payload.businessRegistrationNumber !==
        (business.businessRegistrationNumber ?? '')
    ) {
      throw new BadRequestException(
        'businessRegistrationNumber cannot be updated',
      );
    }
    if (
      payload.taxIdentificationNumber !== undefined &&
      payload.taxIdentificationNumber !==
        (business.taxIdentificationNumber ?? '')
    ) {
      throw new BadRequestException(
        'taxIdentificationNumber cannot be updated',
      );
    }
  }

  getBusinessLookups(): IResponse {
    return {
      status: 'success',
      statusCode: 200,
      message: 'Lookups fetched successfully',
      data: {
        states: this.enumToOptions(NigerianState),
        deliveryScope: this.enumToOptions(DeliveryScope),
        subscriptionPlans: this.enumToOptions(SubscriptionPlan),
        businessDaysOfWeek: this.enumToOptions(BusinessDayOfWeek),
        businessOperatingStatus: this.enumToOptions(BusinessOperatingStatus),
      },
    };
  }

  async getStorefront(slug: string, query: ReviewQueryDTO): Promise<IResponse> {
    const business = await this.businessDb.findBySlug(slug);
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const [averageRating, reviewsResponse] = await Promise.all([
      this.reviewsService.getAverageRating(
        business.id,
        ReviewTargetType.BUSINESS,
      ),
      this.reviewsService.getBusinessReviews(business.id, query),
    ]);

    return {
      status: 'success',
      statusCode: 200,
      message: 'Storefront fetched successfully',
      data: {
        business,
        averageRating,
        reviews: reviewsResponse.data,
      },
      meta: (reviewsResponse as any).meta,
    };
  }
}
