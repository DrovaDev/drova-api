import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Auth, Roles } from 'src/interfaces/customs.decorator';
import { AuthGuard } from '../authentication/guards/authentication.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { UserType } from 'src/constants';
import type { ITokenPayload } from 'src/interfaces/token.interface';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto, TrendQueryDto } from './dtos/analytics.dto';

@Controller('analytics')
@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // ─── business ───────────────────────────────────────────────────────────────

  @Get('business/summary')
  @Roles(UserType.BUSINESS)
  @ApiOperation({
    summary: 'Business overview KPIs',
    description:
      'Returns total orders, active, completed, cancelled, disputed counts, ' +
      'revenue in escrow, total collected, and platform fees paid.',
  })
  getBusinessSummary(
    @Auth() auth: ITokenPayload,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getBusinessSummary(auth, query);
  }

  @Get('business/orders/trend')
  @Roles(UserType.BUSINESS)
  @ApiOperation({
    summary: 'Business order volume over time',
    description:
      'Returns orders bucketed by day/week/month with completed and cancelled counts per bucket.',
  })
  getBusinessOrdersTrend(
    @Auth() auth: ITokenPayload,
    @Query() query: TrendQueryDto,
  ) {
    return this.analyticsService.getBusinessOrdersTrend(auth, query);
  }

  @Get('business/orders/breakdown')
  @Roles(UserType.BUSINESS)
  @ApiOperation({
    summary: 'Business orders by status and delivery priority',
    description: 'Returns count of orders grouped by status, and separately by delivery priority.',
  })
  getBusinessOrdersBreakdown(
    @Auth() auth: ITokenPayload,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getBusinessOrdersBreakdown(auth, query);
  }

  @Get('business/revenue/breakdown')
  @Roles(UserType.BUSINESS)
  @ApiOperation({
    summary: 'Business revenue breakdown',
    description:
      'Returns gross revenue, collected, in-escrow, platform commission, Nomba fees, and net payout.',
  })
  getBusinessRevenueBreakdown(
    @Auth() auth: ITokenPayload,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getBusinessRevenueBreakdown(auth, query);
  }

  @Get('business/riders/summary')
  @Roles(UserType.BUSINESS)
  @ApiOperation({
    summary: 'Business rider fleet summary',
    description:
      'Returns total riders, breakdown by availability status (available/offline/on_trip), ' +
      'active (accepted invite) vs pending invite, and verified count.',
  })
  getBusinessRidersSummary(
    @Auth() auth: ITokenPayload,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getBusinessRidersSummary(auth, query);
  }

  @Get('business/riders/performance')
  @Roles(UserType.BUSINESS)
  @ApiOperation({
    summary: 'Per-rider performance for a business',
    description:
      'Returns each rider with total assigned, completed, cancelled, completion rate and average rating. ' +
      'Sorted by completed deliveries descending.',
  })
  getBusinessRidersPerformance(
    @Auth() auth: ITokenPayload,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getBusinessRidersPerformance(auth, query);
  }

  @Get('business/orders/fulfillment')
  @Roles(UserType.BUSINESS)
  @ApiOperation({
    summary: 'Business delivery fulfillment speed (completed orders only)',
    description:
      'Average minutes between: confirm→assign, assign→pickup, pickup→complete, and total end-to-end.',
  })
  getBusinessOrdersFulfillment(
    @Auth() auth: ITokenPayload,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getBusinessOrdersFulfillment(auth, query);
  }

  // ─── rider ──────────────────────────────────────────────────────────────────

  @Get('rider/summary')
  @Roles(UserType.RIDER)
  @ApiOperation({
    summary: 'Rider overview KPIs',
    description: 'Returns total assigned, completed, cancelled deliveries, and average rating.',
  })
  getRiderSummary(
    @Auth() auth: ITokenPayload,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getRiderSummary(auth, query);
  }

  @Get('rider/earnings/summary')
  @Roles(UserType.RIDER)
  @ApiOperation({
    summary: 'Rider earnings summary',
    description:
      'Returns current wallet balance, total earned (posted business_to_rider_payout credits), ' +
      'total withdrawn, pending payout (earned minus withdrawn), and payout count.',
  })
  getRiderEarningsSummary(
    @Auth() auth: ITokenPayload,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getRiderEarningsSummary(auth, query);
  }

  @Get('rider/earnings/trend')
  @Roles(UserType.RIDER)
  @ApiOperation({
    summary: 'Rider earnings over time',
    description: 'Returns earned amount and payout count bucketed by day/week/month.',
  })
  getRiderEarningsTrend(
    @Auth() auth: ITokenPayload,
    @Query() query: TrendQueryDto,
  ) {
    return this.analyticsService.getRiderEarningsTrend(auth, query);
  }

  @Get('rider/orders/trend')
  @Roles(UserType.RIDER)
  @ApiOperation({
    summary: 'Rider delivery volume over time',
    description: 'Returns deliveries bucketed by day/week/month with completed count per bucket.',
  })
  getRiderOrdersTrend(
    @Auth() auth: ITokenPayload,
    @Query() query: TrendQueryDto,
  ) {
    return this.analyticsService.getRiderOrdersTrend(auth, query);
  }

  @Get('rider/performance')
  @Roles(UserType.RIDER)
  @ApiOperation({
    summary: 'Rider performance metrics',
    description:
      'Returns completion rate, average delivery duration in minutes, average rating, ' +
      'and total/completed/cancelled delivery counts.',
  })
  getRiderPerformance(
    @Auth() auth: ITokenPayload,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getRiderPerformance(auth, query);
  }
}
