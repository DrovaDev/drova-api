import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional } from 'class-validator';

export class AnalyticsQueryDto {
  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    description: 'Filter from this date (ISO 8601)',
    example: '2026-01-01T00:00:00.000Z',
  })
  startDate?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    description: 'Filter up to this date (ISO 8601)',
    example: '2026-12-31T23:59:59.000Z',
  })
  endDate?: string;
}

export class TrendQueryDto extends AnalyticsQueryDto {
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  @ApiPropertyOptional({
    description: 'Time bucket granularity for trend data',
    enum: ['day', 'week', 'month'],
    default: 'day',
  })
  granularity?: 'day' | 'week' | 'month';
}
