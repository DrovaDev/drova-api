import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface InvoicePricingInput {
  deliveryFee: number;
  pickupFee: number;
  packagingFee: number;
}

export interface InvoicePricingResult extends InvoicePricingInput {
  serviceFee: number;
  totalAmount: number;
}

@Injectable()
export class OrderPricingService {
  private readonly commissionRate: number;
  private readonly commissionCap: number;

  constructor(private readonly configService: ConfigService) {
    this.commissionRate = Number(
      this.configService.get<string>('PLATFORM_COMMISSION_RATE') ?? '0.025',
    );
    this.commissionCap = Number(
      this.configService.get<string>('PLATFORM_COMMISSION_CAP') ?? '2000',
    );
  }

  calculateInvoicePricing(input: InvoicePricingInput): InvoicePricingResult {
    const { deliveryFee, pickupFee, packagingFee } = input;
    const subtotal = deliveryFee + pickupFee + packagingFee;

    const serviceFee = Math.min(
      Math.round(subtotal * this.commissionRate * 100) / 100,
      this.commissionCap,
    );

    return {
      deliveryFee,
      pickupFee,
      packagingFee,
      serviceFee,
      totalAmount: subtotal + serviceFee,
    };
  }
}
