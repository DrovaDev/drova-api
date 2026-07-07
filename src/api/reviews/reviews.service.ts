import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ReviewsDb } from './reviews.db';
import { OrderDb } from 'src/api/order/order.db';
import { ReviewTargetType } from 'src/constants';
import { SubmitGuestReviewDTO, ReviewQueryDTO } from './dtos/review.dto';
import { IResponse } from 'src/interfaces/response.interface';
import { UtilsService } from 'src/helpers/utils.service';
import { Orders } from 'src/api/order/schemas/order.schema';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly reviewsDb: ReviewsDb,
    private readonly orderDb: OrderDb,
    private readonly utilsService: UtilsService,
  ) {}

  async submitGuestBusinessReview(
    dto: SubmitGuestReviewDTO,
  ): Promise<IResponse> {
    return this.submitReviewForGuest(dto, ReviewTargetType.BUSINESS);
  }

  async submitGuestRiderReview(dto: SubmitGuestReviewDTO): Promise<IResponse> {
    return this.submitReviewForGuest(dto, ReviewTargetType.RIDER);
  }

  async getAverageRating(
    targetId: string,
    targetType: ReviewTargetType,
  ): Promise<number> {
    return this.reviewsDb.getAverageRating(targetId, targetType);
  }

  async getBusinessReviews(
    businessId: string,
    query: ReviewQueryDTO,
  ): Promise<IResponse> {
    return this.getReviewsByTarget(
      businessId,
      ReviewTargetType.BUSINESS,
      query,
    );
  }

  async getRiderReviews(
    riderId: string,
    query: ReviewQueryDTO,
  ): Promise<IResponse> {
    return this.getReviewsByTarget(riderId, ReviewTargetType.RIDER, query);
  }

  private async submitReviewForGuest(
    dto: SubmitGuestReviewDTO,
    targetType: ReviewTargetType,
  ): Promise<IResponse> {
    const order = await this.resolveOrderByReference(dto.orderReferenceCode);
    this.assertOrderCompleted(order);
    this.assertGuestEmail(order, dto.guestEmail);
    this.assertRiderReviewEligibility(order, targetType);
    await this.assertNoDuplicateReview(order.id, targetType);

    const review = await this.reviewsDb.createReview({
      orderId: order.id,
      guestEmail: dto.guestEmail ?? order.parties?.guestEmail ?? undefined,
      targetType,
      targetId: this.resolveTargetId(order, targetType),
      rating: dto.rating,
      comment: dto.comment,
    });

    return this.buildCreatedResponse('Review submitted successfully', review);
  }

  private async getReviewsByTarget(
    targetId: string,
    targetType: ReviewTargetType,
    query: ReviewQueryDTO,
  ): Promise<IResponse> {
    const sortOrder =
      (query.sortOrder?.toUpperCase() as 'ASC' | 'DESC') || 'DESC';

    const { count } = await this.reviewsDb.findReviewsByTarget(
      targetId,
      targetType,
      {
        offset: 0,
        limit: 0,
        sortOrder,
      },
    );

    const { limit, offset, totalPages } = this.utilsService.getPaginationData(
      { page: query.page, limit: query.limit },
      count,
    );

    const { reviews } = await this.reviewsDb.findReviewsByTarget(
      targetId,
      targetType,
      {
        offset,
        limit,
        sortOrder,
      },
    );

    const averageRating = await this.reviewsDb.getAverageRating(
      targetId,
      targetType,
    );

    return {
      status: 'success',
      statusCode: 200,
      message:
        reviews.length > 0
          ? 'Reviews fetched successfully'
          : 'No reviews found',
      data: {
        averageRating: Number.parseFloat(averageRating.toFixed(1)),
        totalReviews: count,
        reviews,
        meta: { page: query.page ?? 1, limit, totalPages, total: count },
      },
    };
  }

  private async resolveOrderByReference(
    referenceCode: string,
  ): Promise<Orders> {
    const order =
      await this.orderDb.findOrderWithPartiesByReferenceCode(referenceCode);
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private assertOrderCompleted(order: Orders): void {
    if (!this.reviewsDb.isOrderCompleted(order)) {
      throw new BadRequestException(
        'Reviews can only be submitted for completed orders',
      );
    }
  }

  private assertGuestEmail(order: Orders, guestEmail?: string): void {
    if (
      guestEmail &&
      order.parties?.guestEmail &&
      order.parties.guestEmail.toLowerCase() !== guestEmail.toLowerCase()
    ) {
      throw new BadRequestException('Guest email does not match the order');
    }
  }

  private assertRiderReviewEligibility(
    order: Orders,
    targetType: ReviewTargetType,
  ): void {
    if (targetType === ReviewTargetType.RIDER && !order.riderId) {
      throw new BadRequestException('No rider was assigned to this order');
    }
  }

  private async assertNoDuplicateReview(
    orderId: string,
    targetType: ReviewTargetType,
  ): Promise<void> {
    const existing = await this.reviewsDb.findExistingReview(
      orderId,
      targetType,
    );
    if (existing) {
      throw new ConflictException(
        `A ${targetType.toLowerCase()} review for this order already exists`,
      );
    }
  }

  private resolveTargetId(order: Orders, targetType: ReviewTargetType): string {
    return targetType === ReviewTargetType.RIDER
      ? order.riderId!
      : order.businessId;
  }

  private buildCreatedResponse(message: string, data: unknown): IResponse {
    return { status: 'success', statusCode: 201, message, data };
  }
}
