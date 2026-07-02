import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SavePayoutAccountDTO {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: '058', description: 'Bank code' })
  bankCode!: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'GTBank', description: 'Bank name' })
  bankName!: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: '0123456789', description: 'Account number' })
  accountNumber!: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'John Doe', description: 'Account name' })
  accountName!: string;
}

export class UpdatePayoutAccountDTO {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: '058', description: 'Bank code' })
  bankCode?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'GTBank', description: 'Bank name' })
  bankName?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: '0123456789', description: 'Account number' })
  accountNumber?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'John Doe', description: 'Account name' })
  accountName?: string;
}

export class ResolveAccountQueryDTO {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: '0123456789', description: 'Account number to resolve' })
  accountNumber!: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: '058', description: 'Bank code' })
  bankCode!: string;
}
