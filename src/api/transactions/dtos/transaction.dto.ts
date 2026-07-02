import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from 'src/helpers/global.dto';
import { JournalType, PayoutStatus } from 'src/constants';

export class TransactionQueryDTO extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(JournalType, { message: 'Invalid journal type' })
  @ApiPropertyOptional({
    enum: JournalType,
    description: 'Filter by journal type',
  })
  type?: JournalType;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Filter by order ID',
    type: String,
  })
  orderId?: string;
}

export class RequestPayoutDTO {
  @IsNotEmpty()
  @IsNumber()
  @Min(1, { message: 'Amount must be greater than zero' })
  @Type(() => Number)
  @ApiProperty({
    description: 'Amount to withdraw',
    example: 5000,
  })
  amount: number;
}

export class PayoutQueryDTO extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(PayoutStatus, { message: 'Invalid payout status' })
  @ApiPropertyOptional({
    enum: PayoutStatus,
    description: 'Filter by payout status',
  })
  status?: PayoutStatus;
}
