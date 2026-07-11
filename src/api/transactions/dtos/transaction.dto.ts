import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
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

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/, { message: 'Withdrawal PIN must be exactly 4 digits' })
  @ApiPropertyOptional({
    description: '4-digit withdrawal PIN (required for business accounts)',
    example: '1234',
  })
  withdrawalPin?: string;
}

export class BusinessToRiderTransferDTO {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'ID of the rider to transfer funds to',
    example: 'a02aa48b-6f11-437d-a3fa-26af215742cb',
  })
  riderId!: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(1, { message: 'Amount must be greater than zero' })
  @Type(() => Number)
  @ApiProperty({
    description: 'Amount to transfer',
    example: 5000,
  })
  amount!: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Order ID to associate this transfer with',
    example: '312cc669-90d9-4191-a140-a5e8a9742057',
  })
  orderId?: string;
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
