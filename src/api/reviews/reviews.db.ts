import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './schemas/review.schema';
import { OrderStatus, ReviewTargetType } from 'src/constants';
import { Orders } from 'src/api/order/schemas/order.schema';

@Injectable()
export class ReviewsDb {
  constructor(
    @InjectRepository(Review)
    private readonly reviewModel: Repository<Review>,
  ) {}

  findExistingReview(
    orderId: string,
    targetType: ReviewTargetType,
  ): Promise<Review | null> {
    return this.reviewModel.findOne({ where: { orderId, targetType } });
  }

  async createReview(data: {
    orderId: string;
    guestEmail?: string;
    targetType: ReviewTargetType;
    targetId: string;
    rating: number;
    comment?: string;
  }): Promise<Review> {
    return this.reviewModel.save(this.reviewModel.create(data));
  }

  async findReviewsByTarget(
    targetId: string,
    targetType: ReviewTargetType,
    opts: { offset: number; limit: number; sortOrder: 'ASC' | 'DESC' },
  ): Promise<{ reviews: Review[]; count: number }> {
    const [reviews, count] = await this.reviewModel.findAndCount({
      where: { targetId, targetType },
      order: { createdAt: opts.sortOrder },
      skip: opts.offset,
      take: opts.limit,
    });
    return { reviews, count };
  }

  async getAverageRating(
    targetId: string,
    targetType: ReviewTargetType,
  ): Promise<number> {
    const result = await this.reviewModel
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'average')
      .where('review.targetId = :targetId AND review.targetType = :targetType', {
        targetId,
        targetType,
      })
      .getRawOne();

    return result ? Number.parseFloat(result.average) || 0 : 0;
  }

  isOrderCompleted(order: Orders): boolean {
    return order.status === OrderStatus.COMPLETED;
  }
}
