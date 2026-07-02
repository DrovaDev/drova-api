import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from 'src/helpers/global.dto';

export class SubmitReviewDTO {
  @IsNotEmpty()
  @IsUUID()
  @ApiProperty({ description: 'ID of the completed order', example: 'uuid' })
  orderId!: string;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  @ApiProperty({ description: 'Rating from 1 to 5', example: 4 })
  rating!: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'Optional review comment' })
  comment?: string;
}

export class SubmitGuestReviewDTO {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ description: 'Order reference code', example: 'DRV-1234' })
  orderReferenceCode!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'Guest email for verification (must match order)' })
  guestEmail?: string;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  @ApiProperty({ description: 'Rating from 1 to 5', example: 4 })
  rating!: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'Optional review comment' })
  comment?: string;
}

export class ReviewQueryDTO extends PaginationQueryDto {}
