import { Injectable, ForbiddenException } from '@nestjs/common';
import { AnalyticsDb } from './analytics.db';
import { successResponse } from 'src/helpers/response.helper';
import type { IResponse } from 'src/interfaces/response.interface';
import type { ITokenPayload } from 'src/interfaces/token.interface';
import { AnalyticsQueryDto, TrendQueryDto } from './dtos/analytics.dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly analyticsDb: AnalyticsDb) {}

  async getBusinessSummary(
    auth: ITokenPayload,
    query: AnalyticsQueryDto,
  ): Promise<IResponse> {
    this.requireBusiness(auth);
    const data = await this.analyticsDb.getBusinessSummary({
      businessId: auth.businessId!,
      startDate: query.startDate,
      endDate: query.endDate,
    });
    return successResponse('Business summary fetched successfully', data);
  }

  async getBusinessOrdersTrend(
    auth: ITokenPayload,
    query: TrendQueryDto,
  ): Promise<IResponse> {
    this.requireBusiness(auth);
    const data = await this.analyticsDb.getBusinessOrdersTrend({
      businessId: auth.businessId!,
      granularity: query.granularity ?? 'day',
      startDate: query.startDate,
      endDate: query.endDate,
    });
    return successResponse('Orders trend fetched successfully', data);
  }

  async getBusinessOrdersBreakdown(
    auth: ITokenPayload,
    query: AnalyticsQueryDto,
  ): Promise<IResponse> {
    this.requireBusiness(auth);
    const data = await this.analyticsDb.getBusinessOrdersBreakdown({
      businessId: auth.businessId!,
      startDate: query.startDate,
      endDate: query.endDate,
    });
    return successResponse('Orders breakdown fetched successfully', data);
  }

  async getBusinessRevenueBreakdown(
    auth: ITokenPayload,
    query: AnalyticsQueryDto,
  ): Promise<IResponse> {
    this.requireBusiness(auth);
    const data = await this.analyticsDb.getBusinessRevenueBreakdown({
      businessId: auth.businessId!,
      startDate: query.startDate,
      endDate: query.endDate,
    });
    return successResponse('Revenue breakdown fetched successfully', data);
  }

  async getBusinessRidersSummary(
    auth: ITokenPayload,
    query: AnalyticsQueryDto,
  ): Promise<IResponse> {
    this.requireBusiness(auth);
    const data = await this.analyticsDb.getBusinessRidersSummary({
      businessId: auth.businessId!,
      startDate: query.startDate,
      endDate: query.endDate,
    });
    return successResponse('Riders summary fetched successfully', data);
  }

  async getBusinessRidersPerformance(
    auth: ITokenPayload,
    query: AnalyticsQueryDto,
  ): Promise<IResponse> {
    this.requireBusiness(auth);
    const data = await this.analyticsDb.getBusinessRidersPerformance({
      businessId: auth.businessId!,
      startDate: query.startDate,
      endDate: query.endDate,
    });
    return successResponse('Riders performance fetched successfully', data);
  }

  async getBusinessOrdersFulfillment(
    auth: ITokenPayload,
    query: AnalyticsQueryDto,
  ): Promise<IResponse> {
    this.requireBusiness(auth);
    const data = await this.analyticsDb.getBusinessOrdersFulfillment({
      businessId: auth.businessId!,
      startDate: query.startDate,
      endDate: query.endDate,
    });
    return successResponse('Fulfillment metrics fetched successfully', data);
  }

  async getRiderSummary(
    auth: ITokenPayload,
    query: AnalyticsQueryDto,
  ): Promise<IResponse> {
    this.requireRider(auth);
    const data = await this.analyticsDb.getRiderSummary({
      riderId: auth.riderId!,
      startDate: query.startDate,
      endDate: query.endDate,
    });
    return successResponse('Rider summary fetched successfully', data);
  }

  async getRiderOrdersTrend(
    auth: ITokenPayload,
    query: TrendQueryDto,
  ): Promise<IResponse> {
    this.requireRider(auth);
    const data = await this.analyticsDb.getRiderOrdersTrend({
      riderId: auth.riderId!,
      granularity: query.granularity ?? 'day',
      startDate: query.startDate,
      endDate: query.endDate,
    });
    return successResponse('Rider orders trend fetched successfully', data);
  }

  async getRiderEarningsSummary(
    auth: ITokenPayload,
    query: AnalyticsQueryDto,
  ): Promise<IResponse> {
    this.requireRider(auth);
    const data = await this.analyticsDb.getRiderEarningsSummary({
      riderId: auth.riderId!,
      startDate: query.startDate,
      endDate: query.endDate,
    });
    return successResponse('Rider earnings summary fetched successfully', data);
  }

  async getRiderEarningsTrend(
    auth: ITokenPayload,
    query: TrendQueryDto,
  ): Promise<IResponse> {
    this.requireRider(auth);
    const data = await this.analyticsDb.getRiderEarningsTrend({
      riderId: auth.riderId!,
      granularity: query.granularity ?? 'day',
      startDate: query.startDate,
      endDate: query.endDate,
    });
    return successResponse('Rider earnings trend fetched successfully', data);
  }

  async getRiderPerformance(
    auth: ITokenPayload,
    query: AnalyticsQueryDto,
  ): Promise<IResponse> {
    this.requireRider(auth);
    const data = await this.analyticsDb.getRiderPerformance({
      riderId: auth.riderId!,
      startDate: query.startDate,
      endDate: query.endDate,
    });
    return successResponse('Rider performance fetched successfully', data);
  }

  private requireBusiness(auth: ITokenPayload): void {
    if (!auth.businessId) {
      throw new ForbiddenException('Business context is required');
    }
  }

  private requireRider(auth: ITokenPayload): void {
    if (!auth.riderId) {
      throw new ForbiddenException('Rider context is required');
    }
  }
}
