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
  IsIn,
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
import { Type } from 'class-transformer';
import { NigerianState } from 'src/constants';

export class PickupDetailsDTO {
  @IsNotEmpty({ message: 'pickup address is required' })
  @IsString({ message: 'pickup address must be a string' })
  @ApiProperty({
    description: 'Pickup address',
    example: '123 Main St, Lagos, Nigeria',
  })
  pickupAddress: string;

  @IsArray({ message: 'pickup coordinates must be an array' })
  @ArrayNotEmpty({ message: 'pickup coordinates must not be empty' })
  @Type(() => Number)
  @IsNumber({}, { each: true, message: 'pickup coordinates must be numbers' })
  @ApiProperty({
    description: 'Pickup Coordinates in [longitude, latitude] order',
    example: [3.3792, 6.5244],
  })
  pickupCoordinates: [number, number];

  @IsOptional()
  @IsString({ message: 'pickup city must be a string' })
  @ApiPropertyOptional({
    description: 'Pickup city (optional)',
    example: 'Lagos',
  })
  pickupCity?: string;

  @IsEnum(NigerianState, {
    message: `pickup state must be one of: ${Object.values(NigerianState).join(', ')}`,
  })
  @IsNotEmpty({ message: 'pickup state is required' })
  @ApiProperty({
    description: 'Pickup state',
    enum: NigerianState,
    example: NigerianState.LAGOS,
  })
  pickupState: NigerianState;

  @IsOptional()
  @IsString({ message: 'nearest landmark must be a string' })
  @ApiPropertyOptional({ example: 'Landmark event centre' })
  pickupNearestLandmark?: string;

  @IsOptional()
  @IsString({ message: 'contact person name must be a string' })
  @ApiPropertyOptional({ example: 'John Doe' })
  pickupContactPersonName?: string;

  @IsOptional()
  @IsString({ message: 'contact person phone number must be a string' })
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'pickup contact person phone number must be a valid E.164 format',
  })
  @ApiPropertyOptional({ example: '+1234567890' })
  pickupContactPersonPhoneNumber?: string;
}

export class DeliveryDetailsDTO {
  @IsNotEmpty({ message: 'delivery address is required' })
  @IsString({ message: 'delivery address must be a string' })
  @ApiProperty({
    description: 'Delivery address',
    example: '456 Elm St, Abuja, Nigeria',
  })
  deliveryAddress: string;

  @IsArray({ message: 'delivery coordinates must be an array' })
  @ArrayNotEmpty({ message: 'delivery coordinates must not be empty' })
  @Type(() => Number)
  @IsNumber({}, { each: true, message: 'delivery coordinates must be numbers' })
  @ApiProperty({
    description: 'Delivery Coordinates in [longitude, latitude] order',
    example: [7.4958, 9.0578],
  })
  deliveryCoordinates: [number, number];

  @IsEnum(NigerianState, {
    message: `delivery state must be one of: ${Object.values(NigerianState).join(', ')}`,
  })
  @IsNotEmpty({ message: 'delivery state is required' })
  @ApiProperty({
    description: 'Delivery state',
    enum: NigerianState,
    example: NigerianState.FCT,
  })
  deliveryState: NigerianState;

  @IsOptional()
  @IsString({ message: 'nearest landmark must be a string' })
  @ApiPropertyOptional({ example: 'Landmark shopping mall' })
  deliveryNearestLandmark?: string;
}
