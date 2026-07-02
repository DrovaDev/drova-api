export const ORDER_OFFER_QUEUE = 'order-offer';
export const OFFER_EXPIRY_JOB = 'offer_expiry';

export const OFFER_EXPIRY_MS = 5 * 60 * 1000;

export type OfferExpiryJobData = {
  orderId: string;
  riderId: string;
  businessId: string;
  businessAuthId: string;
  businessEmail: string | undefined;
  referenceCode: string;
};
