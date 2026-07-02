import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  OmitType,
} from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  BusinessDayOfWeek,
  BusinessOperatingStatus,
  DeliveryScope,
  NigerianState,
} from 'src/constants';
import { PaginationQueryDto } from 'src/helpers/global.dto';

export class BusinessLocationDTO {
  @IsString({ message: 'location.type must be a string' })
  @IsNotEmpty({ message: 'location.type is required' })
  @ApiProperty({
    description: 'GeoJSON type',
    example: 'Point',
  })
  type: 'Point';

  @IsArray({ message: 'location.coordinates must be an array' })
  @ArrayNotEmpty({ message: 'location.coordinates must not be empty' })
  @Type(() => Number)
  @IsNumber({}, { each: true, message: 'location.coordinates must be numbers' })
  @ApiProperty({
    description: 'Coordinates in [longitude, latitude] order',
    example: [3.3792, 6.5244],
  })
  coordinates: [number, number];
}

export class BusinessOperatingHourDTO {
  @IsEnum(BusinessDayOfWeek, {
    message: `day must be one of: ${Object.values(BusinessDayOfWeek).join(', ')}`,
  })
  @IsNotEmpty({ message: 'day is required' })
  @ApiProperty({
    description: 'Day of the week',
    enum: BusinessDayOfWeek,
    example: BusinessDayOfWeek.MONDAY,
  })
  day: BusinessDayOfWeek;

  @IsOptional()
  @IsString({ message: 'opensAt must be a string' })
  @ApiPropertyOptional({
    description: 'Opening time in business local time (HH:mm) or null',
    example: '09:00',
  })
  opensAt?: string | null;

  @IsOptional()
  @IsString({ message: 'closesAt must be a string' })
  @ApiPropertyOptional({
    description: 'Closing time in business local time (HH:mm) or null',
    example: '17:00',
  })
  closesAt?: string | null;

  @IsEnum(BusinessOperatingStatus, {
    message: `status must be one of: ${Object.values(BusinessOperatingStatus).join(', ')}`,
  })
  @IsNotEmpty({ message: 'status is required' })
  @ApiProperty({
    description: 'Operating status for the day',
    enum: BusinessOperatingStatus,
    example: BusinessOperatingStatus.OPEN,
  })
  status: BusinessOperatingStatus;
}

export class BusinessProfileSetupDTO {
  @IsString({ message: 'businessName must be a string' })
  @IsNotEmpty({ message: 'businessName is required' })
  @ApiProperty({
    description: 'Business name',
    example: 'Drova Logistics',
  })
  businessName: string;

  @IsOptional()
  @IsString({ message: 'businessDescription must be a string' })
  @ApiPropertyOptional({
    description: 'Business description',
    example: 'Fast and reliable delivery service',
  })
  businessDescription?: string;

  @IsString({ message: 'businessAddress must be a string' })
  @IsNotEmpty({ message: 'businessAddress is required' })
  @ApiProperty({
    description: 'Business address',
    example: '12 Adeola Odeku, Victoria Island',
  })
  businessAddress: string;

  @IsEnum(NigerianState, {
    message: `businessState must be one of: ${Object.values(NigerianState).join(', ')}`,
  })
  @IsNotEmpty({ message: 'businessState is required' })
  @ApiProperty({
    description: 'Nigerian state',
    enum: NigerianState,
    example: NigerianState.LAGOS,
  })
  businessState: NigerianState;

  @ValidateNested()
  @Type(() => BusinessLocationDTO)
  @IsNotEmpty({ message: 'location is required' })
  @ApiProperty({
    description: 'Business location as GeoJSON Point',
    type: BusinessLocationDTO,
  })
  location: BusinessLocationDTO;

  @IsArray({ message: 'deliveryScope must be an array' })
  @ArrayNotEmpty({ message: 'deliveryScope is required' })
  @IsEnum(DeliveryScope, {
    each: true,
    message: `deliveryScope must contain only: ${Object.values(DeliveryScope).join(', ')}`,
  })
  @ApiProperty({
    description: 'Delivery scope(s)',
    isArray: true,
    enum: DeliveryScope,
    example: [DeliveryScope.INTRACITY],
  })
  deliveryScope: DeliveryScope[];

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'fleetSize must be an integer' })
  @Min(0, { message: 'fleetSize must be >= 0' })
  @Max(100000, { message: 'fleetSize is too large' })
  @ApiPropertyOptional({
    description: 'Fleet size',
    example: 10,
  })
  fleetSize?: number;

  @IsOptional()
  @IsString({ message: 'businessRegistrationNumber must be a string' })
  @ApiPropertyOptional({
    description: 'Business registration number',
    example: 'RC-1234567',
  })
  businessRegistrationNumber?: string;

  @IsOptional()
  @IsString({ message: 'taxIdentificationNumber must be a string' })
  @ApiPropertyOptional({
    description: 'Tax identification number (TIN)',
    example: '1234567890',
  })
  taxIdentificationNumber?: string;

  @IsOptional()
  @IsString({ message: 'Bank verification number must be a string' })
  @Length(11, 11, { message: 'BVN must be exactly 11 digits long' })
  @Matches(/^\d{11}$/, { message: 'BVN must contain only digits' })
  @ApiPropertyOptional({
    description: 'Bank Verification number (BVN)',
    example: '12345678901',
  })
  bvn?: string;

  @IsString({ message: 'contactNumber must be a string' })
  @IsNotEmpty({ message: 'contactNumber is required' })
  @ApiProperty({
    description: 'Business contact number',
    example: '+2348012345678',
  })
  contactNumber: string;

  @IsOptional()
  @IsString({ message: 'businessLogo must be a string' })
  @ApiPropertyOptional({
    description: 'Logo URL/path',
    example: 'https://cdn.example.com/logo.png',
  })
  businessLogo?: string;

  @IsOptional()
  @IsString({ message: 'coverImage must be a string' })
  @ApiPropertyOptional({
    description: 'Cover image URL/path',
    example: 'https://cdn.example.com/cover.png',
  })
  coverImage?: string;

  @IsOptional()
  @IsArray({ message: 'operatingHours must be an array' })
  @ValidateNested({ each: true })
  @Type(() => BusinessOperatingHourDTO)
  @ApiPropertyOptional({
    description: 'Business operating hours',
    type: [BusinessOperatingHourDTO],
  })
  operatingHours?: BusinessOperatingHourDTO[];
}

export class EditBusinessProfileDTO extends PartialType(
  OmitType(BusinessProfileSetupDTO, [
    'businessName',
    'businessRegistrationNumber',
    'taxIdentificationNumber',
  ] as const),
) {}

export class ValidateBusinessTinDTO {
  @IsString({ message: 'businessRegistrationNumber must be a string' })
  @IsNotEmpty({ message: 'businessRegistrationNumber is required' })
  @ApiProperty({
    description: 'Business registration number (RC)',
    example: '8927781',
  })
  businessRegistrationNumber: string;

  @IsString({ message: 'businessName must be a string' })
  @IsNotEmpty({ message: 'businessName is required' })
  @ApiProperty({
    description: 'Business name to validate against upstream',
    example: 'DROVA COMPANY LTD',
  })
  businessName: string;

  @IsString({ message: 'taxIdentificationNumber must be a string' })
  @IsNotEmpty({ message: 'taxIdentificationNumber is required' })
  @ApiProperty({
    description: 'Tax identification number (TIN) to validate against upstream',
    example: '2622759692634',
  })
  taxIdentificationNumber: string;
}

export class BusinessQueryDTO extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'longitude must be a number' })
  @ApiPropertyOptional({
    description: 'User longitude',
    example: 3.3792,
  })
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'latitude must be a number' })
  @ApiPropertyOptional({
    description: 'User latitude',
    example: 6.5244,
  })
  latitude?: number;

  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsEnum(DeliveryScope, {
    each: true,
    message: `deliveryScope must be one of: ${Object.values(DeliveryScope).join(', ')}`,
  })
  @ApiPropertyOptional({
    description: 'Filter by delivery scope',
    enum: DeliveryScope,
    isArray: true,
    example: [DeliveryScope.INTRACITY],
  })
  deliveryScope?: DeliveryScope[];

  @IsOptional()
  @IsEnum(NigerianState, {
    message: `state must be one of: ${Object.values(NigerianState).join(', ')}`,
  })
  @ApiPropertyOptional({
    description: 'Filter by business state',
    enum: NigerianState,
    example: NigerianState.LAGOS,
  })
  state?: NigerianState;

  @IsOptional()
  @IsEnum(BusinessOperatingStatus, {
    message: `operatingStatus must be one of: ${Object.values(BusinessOperatingStatus).join(', ')}`,
  })
  @ApiPropertyOptional({
    description: 'Filter by whether the business is open or closed today',
    enum: BusinessOperatingStatus,
    example: BusinessOperatingStatus.OPEN,
  })
  operatingStatus?: BusinessOperatingStatus;
}
