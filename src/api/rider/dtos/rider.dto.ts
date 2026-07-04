import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  IsDateString,
} from 'class-validator';
import {
  VehicleType,
  AvailabilityStatus,
  RiderStatus,
  InviteStatus,
} from 'src/constants';
import { PaginationQueryDto } from 'src/helpers/global.dto';

export class CreateRiderProfileDTO {
  @IsString({ message: 'telephoneNumber must be a string' })
  @IsNotEmpty({ message: 'telephoneNumber is required' })
  @ApiProperty({
    description: 'Rider phone number (used for auth and OTP delivery)',
    example: '+2348012345678',
  })
  telephoneNumber: string;

  @IsString({ message: 'firstName must be a string' })
  @IsNotEmpty({ message: 'firstName is required' })
  @ApiProperty({
    description: 'Rider first name',
    example: 'John',
  })
  firstName: string;

  @IsString({ message: 'lastName must be a string' })
  @IsNotEmpty({ message: 'lastName is required' })
  @ApiProperty({
    description: 'Rider last name',
    example: 'Doe',
  })
  lastName: string;

  @IsOptional()
  @IsString({ message: 'otherName must be a string' })
  @ApiPropertyOptional({
    description: 'Rider other name',
    example: 'Michael',
  })
  otherName?: string;

  @IsOptional()
  @IsString({ message: 'profilePhoto must be a string' })
  @ApiPropertyOptional({
    description: 'Rider profile photo URL',
    example: 'https://example.com/photo.png',
  })
  profilePhoto?: string;

  @IsEnum(VehicleType, {
    message: `vehicleType must be one of: ${Object.values(VehicleType).join(', ')}`,
  })
  @IsNotEmpty({ message: 'vehicleType is required' })
  @ApiProperty({
    description: 'Rider vehicle type',
    enum: VehicleType,
    example: VehicleType.BIKE,
  })
  vehicleType: VehicleType;

  @IsOptional()
  @IsString({ message: 'vehiclePlateNumber must be a string' })
  @ApiPropertyOptional({
    description: 'Vehicle plate number',
    example: 'ABC-123XY',
  })
  vehiclePlateNumber?: string;

  @IsOptional()
  @IsString({ message: 'vehicleModel must be a string' })
  @ApiPropertyOptional({
    description: 'Vehicle model',
    example: 'Boxer',
  })
  vehicleModel?: string;

  @IsOptional()
  @IsString({ message: 'vehicleColor must be a string' })
  @ApiPropertyOptional({
    description: 'Vehicle color',
    example: 'Black',
  })
  vehicleColor?: string;
}

export class GetRidersQueryDto extends PaginationQueryDto {
  @IsEnum(AvailabilityStatus, {
    message: `availabilityStatus must be one of: ${Object.values(AvailabilityStatus).join(', ')}`,
  })
  @IsOptional()
  @ApiPropertyOptional({
    description: 'rider availability status',
    enum: AvailabilityStatus,
    example: AvailabilityStatus.OFFLINE,
  })
  availabilityStatus?: AvailabilityStatus;

  @IsEnum(InviteStatus, {
    message: `inviteStatus must be one of: ${Object.values(InviteStatus).join(', ')}`,
  })
  @IsOptional()
  @ApiPropertyOptional({
    description: 'rider invite status',
    enum: InviteStatus,
    example: InviteStatus.ACCEPTED,
  })
  inviteStatus?: InviteStatus;

  @IsEnum(RiderStatus, {
    message: `Status must be one of: ${Object.values(RiderStatus).join(', ')}`,
  })
  @IsOptional()
  @ApiPropertyOptional({
    description: 'rider status',
    enum: RiderStatus,
    example: RiderStatus.ACTIVE,
  })
  status?: RiderStatus;

  @IsDateString()
  @IsOptional()
  @ApiPropertyOptional({
    description: 'Filter by date of transaction',
    type: String,
    example: '2024-01-15T00:00:00.000Z',
  })
  startDate?: string;

  @IsDateString()
  @IsOptional()
  @ApiPropertyOptional({
    description: 'Filter by date of transaction',
    type: String,
    example: '2024-01-15T00:00:00.000Z',
  })
  endDate?: string;
}

export class UpdateRiderProfileDTO extends PartialType(CreateRiderProfileDTO) {}

export class UpdateRiderAvailabilityStatusDTO {
  @IsEnum(AvailabilityStatus, {
    message: `availabilityStatus must be one of: ${Object.values(AvailabilityStatus).join(', ')}`,
  })
  @IsNotEmpty({ message: 'availabilityStatus is required' })
  @ApiProperty({
    description: 'Rider availability status',
    enum: AvailabilityStatus,
    example: AvailabilityStatus.AVAILABLE,
  })
  availabilityStatus: AvailabilityStatus;
}

export class UpdateRiderLocationDTO {
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 10 },
    { message: 'latitude must be a valid number' },
  )
  @Min(-90, { message: 'latitude must be greater than or equal to -90' })
  @Max(90, { message: 'latitude must be less than or equal to 90' })
  @ApiProperty({
    description: 'Rider latitude',
    example: 6.524379,
  })
  latitude: number;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 10 },
    { message: 'longitude must be a valid number' },
  )
  @Min(-180, { message: 'longitude must be greater than or equal to -180' })
  @Max(180, { message: 'longitude must be less than or equal to 180' })
  @ApiProperty({
    description: 'Rider longitude',
    example: 3.379206,
  })
  longitude: number;
}

export class ValidateRiderPhoneNumberOtpDTO {
  @IsString({ message: 'telephoneNumber must be a string' })
  @IsNotEmpty({ message: 'telephoneNumber is required' })
  @ApiProperty({
    description: 'Rider WhatsApp phone number',
    example: '+2348012345678',
  })
  telephoneNumber: string;

  @IsString({ message: 'otp must be a string' })
  @IsNotEmpty({ message: 'otp is required' })
  @ApiProperty({
    description: 'One-time password sent to rider WhatsApp',
    example: '123456',
  })
  otp: string;
}

export class ResendRiderOtpDTO {
  @IsString({ message: 'telephoneNumber must be a string' })
  @IsNotEmpty({ message: 'telephoneNumber is required' })
  @ApiProperty({
    description: 'Rider WhatsApp phone number',
    example: '+2348012345678',
  })
  telephoneNumber: string;
}
