import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsString,
  Length,
  Min,
  Max,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PickupDetailsDTO, DeliveryDetailsDTO } from './location.dto';
import { RecipientDetailDTO } from './recipient-details.dto';
import { SenderDetailDTO } from './sender-details.dto';
import { OrderItemDTO } from './item.dto';
import {
  PickupMethod,
  DeliveryPriority,
  OrderStatus,
  PaymentStatus,
} from 'src/constants';
import { PaginationQueryDto } from 'src/helpers/global.dto';

export class BaseOrderDTO {
  @IsEnum(PickupMethod, {
    message: `pickupMethod must be one of: ${Object.values(PickupMethod).join(', ')}`,
  })
  @IsNotEmpty({ message: 'pickupMethod is required' })
  @ApiProperty({
    description: 'Method of pickup',
    enum: PickupMethod,
    example: PickupMethod.BUSINESS_PICKUP,
  })
  pickupMethod: PickupMethod;

  @IsEnum(DeliveryPriority, {
    message: `deliveryPriority must be one of: ${Object.values(DeliveryPriority).join(', ')}`,
  })
  @IsNotEmpty({ message: 'deliveryPriority is required' })
  @ApiProperty({
    description: 'Priority of delivery',
    enum: DeliveryPriority,
    example: DeliveryPriority.EXPRESS,
  })
  deliveryPriority: DeliveryPriority;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    description: 'Preferred delivery time (optional)',
    example: '2024-06-30T14:00:00Z',
  })
  preferredDeliveryTime?: string;

  @IsOptional()
  @IsString({ message: 'customer note must be a string' })
  @ApiPropertyOptional({
    description: 'Customer note to the recipient (optional)',
    example: 'Thank you for patronizing our service!',
  })
  customerNote?: string;

  @ValidateNested()
  @Type(() => SenderDetailDTO)
  @ApiProperty({
    description: 'Details of the sender',
    type: SenderDetailDTO,
  })
  senderDetails: SenderDetailDTO;

  @ValidateNested()
  @Type(() => RecipientDetailDTO)
  @ApiProperty({
    description: 'Details of the recipient',
    type: RecipientDetailDTO,
  })
  recipientDetails: RecipientDetailDTO;

  @ValidateNested()
  @Type(() => PickupDetailsDTO)
  @ApiProperty({
    description: 'Details of the pickup location',
    type: PickupDetailsDTO,
  })
  pickupDetails: PickupDetailsDTO;

  @ValidateNested()
  @Type(() => DeliveryDetailsDTO)
  @ApiProperty({
    description: 'Details of the delivery location',
    type: DeliveryDetailsDTO,
  })
  deliveryDetails: DeliveryDetailsDTO;

  @IsArray({ message: 'items must be an array' })
  @ArrayNotEmpty({ message: 'items must not be empty' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDTO)
  @ApiProperty({
    description: 'List of items to be delivered',
    type: [OrderItemDTO],
  })
  items: OrderItemDTO[];

  @IsOptional()
  @IsString({ message: 'pickup instructions must be a string' })
  @ApiPropertyOptional({
    description: 'Special instructions for the pickup (optional)',
    example:
      'Call this number +2348145504359 when you get to the pickup location',
  })
  pickupInstructions?: string;

  @IsOptional()
  @IsString({ message: 'delivery instructions must be a string' })
  @ApiPropertyOptional({
    description: 'Special instructions for the delivery (optional)',
    example: 'Leave the package at the front door if no one is home',
  })
  deliveryInstructions?: string;
}

export class CreateOrderDTO extends BaseOrderDTO {
  @IsOptional()
  @IsString({ message: 'businessSlug must be a string' })
  @ApiPropertyOptional({
    description:
      'Public slug of the business storefront (required for guests placing an order)',
    example: 'fast-couriers-lagos',
  })
  businessSlug?: string;
}

export class ManuallyAssingOrderDTO {
  @IsNotEmpty({ message: 'orderId is required' })
  @IsString({ message: 'orderId must be a string' })
  @ApiProperty({
    description: 'ID of the order to be assigned',
    example: '60c72b2f9b1d8c001f8e4e3a',
  })
  orderId: string;

  @IsNotEmpty({ message: 'rider Id is required' })
  @IsString({ message: 'rider Id must be a string' })
  @ApiProperty({
    description: 'ID of the rider to assign the order to',
    example: '60c72b2f9b1d8c001f8e4e3a',
  })
  riderId: string;
}

const RIDER_UPDATABLE_STATUSES = [
  OrderStatus.EN_ROUTE_PICKUP,
  OrderStatus.PICKED_UP,
  OrderStatus.IN_TRANSIT,
  OrderStatus.ARRIVED_AT_DELIVERY,
] as const;

export type RiderUpdatableStatus = (typeof RIDER_UPDATABLE_STATUSES)[number];

export class UpdateRiderOrderStatusDTO {
  @IsEnum(RIDER_UPDATABLE_STATUSES, {
    message: `status must be one of: ${RIDER_UPDATABLE_STATUSES.join(', ')}`,
  })
  @ApiProperty({
    description: 'New order status',
    enum: RIDER_UPDATABLE_STATUSES,
    example: OrderStatus.PICKED_UP,
  })
  status: RiderUpdatableStatus = OrderStatus.EN_ROUTE_PICKUP;
}

export class OrderQueryDTO extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus, {
    message: `status must be one of: ${Object.values(OrderStatus).join(', ')}`,
  })
  @ApiPropertyOptional({
    description: 'Filter by order status',
    enum: OrderStatus,
    example: OrderStatus.PENDING,
  })
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(PaymentStatus, {
    message: `paymentStatus must be one of: ${Object.values(PaymentStatus).join(', ')}`,
  })
  @ApiPropertyOptional({
    description: 'Filter by payment status',
    enum: PaymentStatus,
    example: PaymentStatus.PENDING,
  })
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsEnum(PickupMethod, {
    message: `pickupMethod must be one of: ${Object.values(PickupMethod).join(', ')}`,
  })
  @ApiPropertyOptional({
    description: 'Filter by pickup method',
    enum: PickupMethod,
  })
  pickupMethod?: PickupMethod;

  @IsOptional()
  @IsEnum(DeliveryPriority, {
    message: `deliveryPriority must be one of: ${Object.values(DeliveryPriority).join(', ')}`,
  })
  @ApiPropertyOptional({
    description: 'Filter by delivery priority',
    enum: DeliveryPriority,
  })
  deliveryPriority?: DeliveryPriority;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    description: 'Filter orders from this date',
    type: String,
    example: '2024-01-15T00:00:00.000Z',
  })
  startDate?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    description: 'Filter orders up to this date',
    type: String,
    example: '2024-12-31T23:59:59.000Z',
  })
  endDate?: string;
}

export class SendInvoiceDTO {
  @Type(() => Number)
  @IsNumber({}, { message: 'deliveryFee must be a number' })
  @Min(0, { message: 'deliveryFee must be >= 0' })
  @ApiProperty({
    description: 'Delivery fee for this order',
    example: 3000,
  })
  deliveryFee: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'pickupFee must be a number' })
  @Min(0, { message: 'pickupFee must be >= 0' })
  @ApiPropertyOptional({
    description:
      'Fee for the rider to pick up the package from the sender. Only applicable when pickupMethod is business_pickup',
    example: 500,
  })
  pickupFee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'packagingFee must be a number' })
  @Min(0, { message: 'packagingFee must be >= 0' })
  @ApiPropertyOptional({
    description: 'Fee for packaging the item, if packaging was requested',
    example: 500,
  })
  packagingFee?: number;

  @IsOptional()
  @IsString({ message: 'note must be a string' })
  @ApiPropertyOptional({
    description: 'Optional note to include in the invoice email',
    example: 'Includes fragile item handling surcharge',
  })
  note?: string;
}

export class CancelOrderDTO {
  @IsOptional()
  @IsString({ message: 'reason must be a string' })
  @ApiPropertyOptional({
    description: 'Optional reason for cancellation',
    example: 'Customer requested cancellation',
  })
  reason?: string;
}

export class ValidateDeliveryPinDTO {
  @IsNotEmpty({ message: 'Delivery pin is required' })
  @IsString({ message: 'Delivery pin must be a string' })
  @Length(6, 6, { message: 'Delivery pin must be exactly 6 characters' })
  @ApiProperty({
    description: 'The 6-digit delivery pin provided to the recipient',
    example: '482910',
  })
  pin: string;
}

export class ResendTrackingDTO {
  @IsEmail({}, { message: 'A valid email address is required' })
  @IsNotEmpty()
  @ApiProperty({
    description: 'The email address used when placing the order. Used to verify ownership before resending.',
    example: 'sender@example.com',
  })
  email: string;
}
