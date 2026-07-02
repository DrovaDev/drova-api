import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserType } from 'src/constants';
import { Auth, Roles } from 'src/interfaces/customs.decorator';
import type { ITokenPayload } from 'src/interfaces/token.interface';
import { AuthGuard } from '../authentication/guards/authentication.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { RiderLocationThrottlerGuard } from './guards/rider-location-throttler.guard';
import {
  CreateRiderProfileRequestDTO,
  GetRidersQueryDto,
  InitiateRiderPhoneValidationDTO,
  ResendRiderOtpDTO,
  UpdateRiderAvailabilityStatusDTO,
  UpdateRiderLocationDTO,
  UpdateRiderProfileDTO,
  ValidateRiderPhoneNumberOtpDTO,
} from './dtos/rider.dto';
import { RiderService } from './rider.service';

@Controller('rider')
@ApiTags('rider')
export class RiderController {
  constructor(private readonly riderService: RiderService) {}

  @Post('initiate-phone-validation')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send OTP to rider phone number (business only)' })
  @ApiBody({ type: InitiateRiderPhoneValidationDTO })
  async initiateRiderPhoneNumberValidation(
    @Auth() auth: ITokenPayload,
    @Body() payload: InitiateRiderPhoneValidationDTO,
  ) {
    if (!auth.businessId) {
      throw new ForbiddenException('Business context is required');
    }
    return await this.riderService.initiateRiderPhoneNumberValidation(
      auth.businessId,
      payload,
    );
  }

  @Post('resend-otp')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resend rider OTP (business only)' })
  @ApiBody({ type: ResendRiderOtpDTO })
  async resendRiderOtp(@Body() payload: ResendRiderOtpDTO) {
    return await this.riderService.resendRiderOtp(payload);
  }

  @Post('validate-otp')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validate rider OTP (business only)' })
  @ApiBody({ type: ValidateRiderPhoneNumberOtpDTO })
  async validateRiderOtp(@Body() payload: ValidateRiderPhoneNumberOtpDTO) {
    return await this.riderService.validateRiderOtp(payload);
  }

  @Post('profile')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS, UserType.RIDER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create rider profile (rider self-register or business)' })
  @ApiBody({ type: CreateRiderProfileRequestDTO })
  async createRiderProfile(
    @Auth() auth: ITokenPayload,
    @Body() payload: CreateRiderProfileRequestDTO,
  ) {
    if (auth.userType === UserType.RIDER) {
      if (!auth.businessId) {
        throw new ForbiddenException('Business context is required');
      }
      return await this.riderService.createRiderSelfProfile(
        auth.id,
        auth.businessId,
        payload,
      );
    }

    if (!auth.businessId) {
      throw new ForbiddenException('Business context is required');
    }
    if (!payload.phoneNumber) {
      throw new ForbiddenException('phoneNumber is required');
    }

    const { phoneNumber, ...profile } = payload;
    return await this.riderService.createRiderProfile(
      auth.businessId,
      phoneNumber,
      profile,
    );
  }

  @Get('me')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.RIDER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my rider profile (rider only)' })
  async getMyRiderProfile(@Auth() auth: ITokenPayload) {
    return await this.riderService.getMyRiderProfile(auth.id);
  }

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all riders for a business (business only)' })
  async getAllRiders(
    @Auth() auth: ITokenPayload,
    @Query() query: GetRidersQueryDto,
  ) {
    if (!auth.businessId) {
      throw new ForbiddenException('Business context is required');
    }
    return await this.riderService.getAllRiders(auth.businessId, query);
  }

  @Get(':riderId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a rider by id (business only)' })
  async getRiderById(
    @Auth() auth: ITokenPayload,
    @Param('riderId') riderId: string,
  ) {
    if (!auth.businessId) {
      throw new ForbiddenException('Business context is required');
    }
    return await this.riderService.getRiderById(auth.businessId, riderId);
  }

  @Patch()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS, UserType.RIDER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a rider profile (rider or business)' })
  @ApiQuery({
    name: 'riderId',
    type: String,
    required: false,
    description: 'riderId required when caller is business',
  })
  @ApiBody({ type: UpdateRiderProfileDTO })
  async updateRiderProfile(
    @Auth() auth: ITokenPayload,
    @Query('riderId') riderId: string | undefined,
    @Body() payload: UpdateRiderProfileDTO,
  ) {
    if (auth.userType === UserType.RIDER) {
      return await this.riderService.updateRiderProfile(
        undefined,
        auth.businessId,
        payload,
        auth.id,
      );
    }

    if (!riderId) {
      throw new ForbiddenException('riderId is required');
    }

    const businessId = auth.businessId;
    if (!businessId) {
      throw new ForbiddenException('Business context is required');
    }

    return await this.riderService.updateRiderProfile(riderId, businessId, payload);
  }

  @Delete(':riderId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS, UserType.RIDER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soft delete a rider (rider or business)' })
  async deleteRider(
    @Auth() auth: ITokenPayload,
    @Param('riderId') riderId: string,
  ) {
    if (auth.userType === UserType.RIDER) {
      if (!auth.riderId || auth.riderId !== riderId) {
        throw new ForbiddenException('You can only delete your own profile');
      }
    }

    const businessId = auth.businessId;
    if (!businessId) {
      throw new ForbiddenException('Business context is required');
    }

    return await this.riderService.deleteRider(businessId, riderId);
  }

  @Patch(':riderId/availability')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS, UserType.RIDER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update rider availability status' })
  @ApiBody({ type: UpdateRiderAvailabilityStatusDTO })
  async updateRiderAvailabilityStatus(
    @Auth() auth: ITokenPayload,
    @Param('riderId') riderId: string,
    @Body() payload: UpdateRiderAvailabilityStatusDTO,
  ) {
    if (auth.userType === UserType.RIDER) {
      if (!auth.riderId || auth.riderId !== riderId) {
        throw new ForbiddenException(
          'You can only update your own availability status',
        );
      }
    }

    const businessId = auth.businessId;
    if (!businessId) {
      throw new ForbiddenException('Business context is required');
    }

    return await this.riderService.updateRiderAvailabilityStatus(
      businessId,
      riderId,
      payload.availabilityStatus,
    );
  }

  @Patch(':riderId/location')
  @UseGuards(AuthGuard, RiderLocationThrottlerGuard, RolesGuard)
  @Roles(UserType.RIDER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update rider current location (rider only)' })
  @ApiBody({ type: UpdateRiderLocationDTO })
  @Throttle({ default: { limit: 1, ttl: 5000 } })
  async updateRiderLocation(
    @Auth() auth: ITokenPayload,
    @Param('riderId') riderId: string,
    @Body() payload: UpdateRiderLocationDTO,
  ) {
    if (!auth.riderId || auth.riderId !== riderId) {
      throw new ForbiddenException('You can only update your own location');
    }

    const businessId = auth.businessId;
    if (!businessId) {
      throw new ForbiddenException('Business context is required');
    }

    return await this.riderService.updateRiderLocation(
      businessId,
      riderId,
      payload.latitude,
      payload.longitude,
    );
  }
}
