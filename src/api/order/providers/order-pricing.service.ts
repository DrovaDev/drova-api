import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface InvoicePricingInput {
  deliveryFee: number;
  pickupFee: number;
  packagingFee: number;
}

export interface InvoicePricingResult extends InvoicePricingInput {
  serviceFee: number;
  nombaFee: number;
  totalAmount: number;
}

@Injectable()
export class OrderPricingService {
  private readonly commissionRate: number;
  private readonly commissionCap: number;
  private readonly nombaFeeRate: number;
  private readonly nombaFeeCap: number;

  constructor(private readonly configService: ConfigService) {
    this.commissionRate = Number(
      this.configService.get<string>('PLATFORM_COMMISSION_RATE') ?? '0.025',
    );
    this.commissionCap = Number(
      this.configService.get<string>('PLATFORM_COMMISSION_CAP') ?? '2000',
    );
    this.nombaFeeRate = Number(
      this.configService.get<string>('NOMBA_FEE_RATE') ?? '0.014',
    );
    this.nombaFeeCap = Number(
      this.configService.get<string>('NOMBA_FEE_CAP') ?? '1800',
    );
  }

  calculateInvoicePricing(input: InvoicePricingInput): InvoicePricingResult {
    const { deliveryFee, pickupFee, packagingFee } = input;
    const subtotal = deliveryFee + pickupFee + packagingFee;

    const serviceFee = Math.min(
      Math.round(subtotal * this.commissionRate * 100) / 100,
      this.commissionCap,
    );

    const preNombaTotal = subtotal + serviceFee;
    const nombaFee = Math.min(
      Math.ceil(preNombaTotal * this.nombaFeeRate * 100) / 100,
      this.nombaFeeCap,
    );

    return {
      deliveryFee,
      pickupFee,
      packagingFee,
      serviceFee,
      nombaFee,
      totalAmount: preNombaTotal + nombaFee,
    };
  }
}
