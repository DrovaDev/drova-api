import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { SubmitGuestReviewDTO, ReviewQueryDTO } from './dtos/review.dto';

@Controller('reviews')
@ApiTags('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('guest/business')
  @ApiOperation({ summary: 'Submit a business review (no auth required)' })
  async submitGuestBusinessReview(@Body() dto: SubmitGuestReviewDTO) {
    return this.reviewsService.submitGuestBusinessReview(dto);
  }

  @Post('guest/rider')
  @ApiOperation({ summary: 'Submit a rider review (no auth required)' })
  async submitGuestRiderReview(@Body() dto: SubmitGuestReviewDTO) {
    return this.reviewsService.submitGuestRiderReview(dto);
  }

  @Get('business/:businessId')
  @ApiOperation({ summary: 'Fetch paginated reviews for a business (public)' })
  async getBusinessReviews(
    @Param('businessId') businessId: string,
    @Query() query: ReviewQueryDTO,
  ) {
    return this.reviewsService.getBusinessReviews(businessId, query);
  }

  @Get('rider/:riderId')
  @ApiOperation({ summary: 'Fetch paginated reviews for a rider (public)' })
  async getRiderReviews(
    @Param('riderId') riderId: string,
    @Query() query: ReviewQueryDTO,
  ) {
    return this.reviewsService.getRiderReviews(riderId, query);
  }
}
