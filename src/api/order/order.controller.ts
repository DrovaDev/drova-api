import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Query,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiBody, ApiOperation } from '@nestjs/swagger';
import { Auth, Roles } from 'src/interfaces/customs.decorator';
import { OptionalAuthGuard } from '../authentication/guards/optional-auth.guard';
import { AuthGuard } from '../authentication/guards/authentication.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { UserType } from 'src/constants';
import type { ITokenPayload } from 'src/interfaces/token.interface';
import { OrderService } from './providers/order.service';
import {
  CancelOrderDTO,
  CreateDirectOrderDTO,
  CreateOrderDTO,
  ManuallyAssingOrderDTO,
  OrderQueryDTO,
  ResendTrackingDTO,
  SendInvoiceDTO,
  UpdateRiderOrderStatusDTO,
  ValidateDeliveryPinDTO,
} from './dtos/order.dto';

@Controller('order')
@ApiTags('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post('create')
  @UseGuards(OptionalAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Submit a quotation request to a business. The business will review and send an invoice before payment is required.',
  })
  @ApiBody({
    type: CreateOrderDTO,
    description: 'Quotation request payload',
  })
  async createOrder(
    @Auth() auth: ITokenPayload | null,
    @Body() payload: CreateOrderDTO,
  ) {
    return await this.orderService.createOrder(auth, payload);
  }

  @Post('direct')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Business creates an order with pricing already set (business only)',
    description:
      'paymentMethod=online: generates a shareable Nomba payment link for the customer. ' +
      'paymentMethod=cash|bank_transfer: marks the order as paid immediately — ready for rider assignment.',
  })
  @ApiBody({ type: CreateDirectOrderDTO })
  async createDirectOrder(
    @Auth() auth: ITokenPayload,
    @Body() payload: CreateDirectOrderDTO,
  ) {
    return await this.orderService.createDirectOrder(auth, payload);
  }

  @Post(':orderId/invoice')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Send an invoice to the customer for a pending order. Sets the price and generates a payment link. Business only.',
  })
  @ApiBody({
    type: SendInvoiceDTO,
    description: 'Invoice payload with amount and optional breakdown',
  })
  async sendInvoice(
    @Auth() auth: ITokenPayload,
    @Param('orderId') orderId: string,
    @Body() payload: SendInvoiceDTO,
  ) {
    return await this.orderService.sendInvoice(orderId, payload, auth);
  }

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Fetch paginated and filtered orders for a business (business only)',
  })
  async getBusinessOrders(
    @Auth() auth: ITokenPayload,
    @Query() query: OrderQueryDTO,
  ) {
    if (!auth.businessId) {
      throw new ForbiddenException('Business context is required');
    }
    return await this.orderService.getBusinessOrders(auth.businessId, query);
  }

  @Post('assign')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Manually assign an order to a rider (business only)',
  })
  @ApiBody({ type: ManuallyAssingOrderDTO })
  async manuallyAssignOrderToRider(
    @Auth() auth: ITokenPayload,
    @Body() payload: ManuallyAssingOrderDTO,
  ) {
    if (!auth.businessId) {
      throw new ForbiddenException('Business context is required');
    }

    return await this.orderService.manuallyAssignOrderToRider(
      auth.businessId,
      payload,
    );
  }

  @Get('my-pending-offer')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.RIDER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get the current pending order offer for the rider (rider only)',
    description:
      'Returns the active OFFER_PENDING order assigned to this rider, or null if none. ' +
      'Call this on app open to determine whether to show the offer modal.',
  })
  async getMyPendingOffer(@Auth() auth: ITokenPayload) {
    return await this.orderService.getMyPendingOffer(auth);
  }

  @Get('rider-orders')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.RIDER)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Fetch paginated and filtered orders for the authenticated rider (rider only)',
  })
  async getRiderOrders(
    @Auth() auth: ITokenPayload,
    @Query() query: OrderQueryDTO,
  ) {
    if (!auth.riderId) {
      throw new ForbiddenException('Rider context is required');
    }
    return await this.orderService.getRiderOrders(auth.riderId, query);
  }

  @Get('track/:referenceCode')
  @ApiOperation({
    summary: 'Track an order by its reference code (public)',
  })
  async trackOrder(@Param('referenceCode') referenceCode: string) {
    return await this.orderService.trackOrder(referenceCode);
  }

  @Post('track/:referenceCode/resend')
  @ApiOperation({
    summary: 'Resend the tracking link to the customer (public)',
    description:
      'Sends a tracking link email if the provided email matches the one used when placing the order. ' +
      'Always returns the same response to prevent information leakage.',
  })
  @ApiBody({ type: ResendTrackingDTO })
  async resendTrackingLink(
    @Param('referenceCode') referenceCode: string,
    @Body() payload: ResendTrackingDTO,
  ) {
    return await this.orderService.resendTrackingLink(referenceCode, payload);
  }

  @Post(':id/cancel')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cancel an order (business only)',
    description:
      'Cancellable statuses: pending, invoiced, payment_confirmed, offer_pending, assigned. ' +
      'Orders en route or beyond cannot be cancelled. Escrow is automatically reversed if payment was held.',
  })
  @ApiBody({ type: CancelOrderDTO })
  async cancelOrder(
    @Auth() auth: ITokenPayload,
    @Param('id') id: string,
    @Body() payload: CancelOrderDTO,
  ) {
    return await this.orderService.cancelOrder(id, auth, payload);
  }

  @Post(':id/accept-offer')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.RIDER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept a pending order offer (rider only)' })
  async acceptOrderOffer(@Auth() auth: ITokenPayload, @Param('id') id: string) {
    return await this.orderService.acceptOrderOffer(id, auth);
  }

  @Post(':id/reject-offer')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.RIDER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject a pending order offer (rider only)' })
  async rejectOrderOffer(@Auth() auth: ITokenPayload, @Param('id') id: string) {
    return await this.orderService.rejectOrderOffer(id, auth);
  }

  @Post(':id/validate-pin')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.RIDER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validate delivery pin for an order (rider only)' })
  async validateDeliveryPin(
    @Auth() auth: ITokenPayload,
    @Param('id') id: string,
    @Body() payload: ValidateDeliveryPinDTO,
  ) {
    return await this.orderService.validateDeliveryPin(id, payload.pin, auth);
  }

  @Patch(':id/status')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.RIDER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update order status during a trip (rider only)',
    description:
      'Allowed transitions: assigned → en_route_pickup → picked_up → in_transit → arrived_at_delivery. Final step (completed) is done via pin validation.',
  })
  @ApiBody({ type: UpdateRiderOrderStatusDTO })
  async updateRiderOrderStatus(
    @Auth() auth: ITokenPayload,
    @Param('id') id: string,
    @Body() payload: UpdateRiderOrderStatusDTO,
  ) {
    if (!auth.riderId) {
      throw new ForbiddenException('Rider context is required');
    }
    return await this.orderService.updateRiderOrderStatus(
      id,
      auth.riderId,
      payload.status,
    );
  }

  @Post(':orderId/resend-invoice')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Resend the invoice for an invoiced order (business only)',
    description:
      'Generates a fresh Nomba checkout link and re-sends the invoice email to the customer. ' +
      'Only works when the order is in INVOICED status. The previous payment link is invalidated.',
  })
  async resendInvoice(
    @Auth() auth: ITokenPayload,
    @Param('orderId') orderId: string,
  ) {
    return await this.orderService.resendInvoice(orderId, auth);
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS, UserType.RIDER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Fetch a single order by ID (business or rider)' })
  async getOrderById(@Auth() auth: ITokenPayload, @Param('id') id: string) {
    return await this.orderService.getOrderById(id, auth);
  }
}
