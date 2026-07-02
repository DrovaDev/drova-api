import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PackageType } from 'src/constants';

export class OrderItemDTO {
  @IsString({ message: 'packageName must be a string' })
  @IsNotEmpty({ message: 'packageName is required' })
  @ApiProperty({
    description: 'Name of product/package to be delivered',
    example: 'MacBook Pro M3 16-inch',
  })
  packageName: string;

  @IsOptional()
  @IsString({ message: 'packageDescription must be a string' })
  @ApiPropertyOptional({
    description: 'Description of product/package to be delivered',
    example:
      'Latest MacBook Pro with M3 chip, 16-inch display, 32GB RAM, 1TB SSD.',
  })
  packageDescription?: string;

  @IsEnum(PackageType, {
    message: `packageType must be one of: ${Object.values(PackageType).join(', ')}`,
  })
  @IsNotEmpty({ message: 'packageType is required' })
  @ApiProperty({
    description: 'Type of package to be delivered',
    enum: PackageType,
    example: PackageType.ELECTRONICS,
  })
  packageType: PackageType;

  @Type(() => Number)
  @IsInt({ message: 'quantity must be an integer' })
  @Min(1, { message: 'quantity must be at least 1' })
  @IsNotEmpty({ message: 'quantity is required' })
  @ApiProperty({
    description: 'Quantity of the product/package to be delivered',
    example: 2,
  })
  quantity: number;

  @IsNotEmpty({ message: 'item estimated value is required' })
  @Type(() => Number)
  @IsNumber({}, { message: 'estimatedValue must be a number' })
  @Min(0, { message: 'estimatedValue must be >= 0' })
  @ApiProperty({
    description: 'Estimated value of the item in Naira',
    example: 150000.0,
  })
  estimatedValue: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'estimatedWeight must be a number' })
  @Min(0, { message: 'estimatedWeight must be >= 0' })
  @ApiPropertyOptional({
    description: 'Estimated weight of the item in kilograms',
    example: 2.5,
  })
  estimatedWeight?: number;

  @IsOptional()
  @IsString({ message: 'specialInstructions must be a string' })
  @ApiPropertyOptional({
    description: 'Any additional instructions for handling the item',
    example: 'Handle with care, keep upright',
  })
  specialInstructions?: string;
}
