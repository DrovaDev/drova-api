import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsDb } from './analytics.db';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsDb],
})
export class AnalyticsModule {}
