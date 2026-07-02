import { IsOptional, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationQueryDto {
  @ApiPropertyOptional({
    default: 1,
    description: 'Page number (starts from 1)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  page?: number = 1;

  @ApiPropertyOptional({
    default: 20,
    description: 'Items per page',
  })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Field to sort by',
  })
  @IsOptional()
  @Type(() => String)
  sortBy?: string;

  @ApiPropertyOptional({
    enum: ['asc', 'desc'],
    description: 'Sort order',
  })
  @IsOptional()
  @Type(() => String)
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({
    description: 'Search term to filter results',
  })
  @IsOptional()
  @Type(() => String)
  search?: string;
}
