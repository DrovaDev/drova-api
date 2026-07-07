export const PAYMENT_EMAIL_QUEUE = 'payment-email';

export const PAYMENT_SUCCESS_EMAIL_JOB = 'payment_success_email';
export const PAYMENT_FAILED_EMAIL_JOB = 'payment_failed_email';
export const INVOICE_EMAIL_JOB = 'invoice_email';
export const ORDER_STATUS_EMAIL_JOB = 'order_status_email';

export type PaymentSuccessEmailEnqueueData = {
  senderEmail?: string;
  senderName?: string;
  recipientEmail?: string;
  recipientName?: string;
  businessEmail?: string;
  businessName?: string;
  referenceCode: string;
  amount: number;
  deliveryPin: string;
  orderId?: string;
};

export type PaymentFailedEmailEnqueueData = {
  senderEmail?: string;
  senderName?: string;
  businessEmail?: string;
  businessName?: string;
  referenceCode: string;
  amount: number;
  reason?: string;
};

export type PaymentSuccessEmailJobData = {
  kind: 'sender' | 'recipient' | 'business';
  to: string;
  name: string;
  referenceCode: string;
  amount: number;
  deliveryPin?: string;
  orderId?: string;
};

export type PaymentFailedEmailJobData = {
  kind: 'sender' | 'business';
  to: string;
  name: string;
  referenceCode: string;
  amount: number;
  reason?: string;
};

export type InvoiceEmailEnqueueData = {
  customerEmail: string;
  customerName: string;
  businessName: string;
  referenceCode: string;
  amount: number;
  paymentLink: string;
  note?: string;
  breakdown?: Record<string, any>;
};

export type InvoiceEmailJobData = {
  to: string;
  customerName: string;
  businessName: string;
  referenceCode: string;
  amount: number;
  paymentLink: string;
  note?: string;
  breakdown?: Record<string, any>;
};

export type OrderStatusEmailEnqueueData = {
  status: string;
  referenceCode: string;
  senderEmail?: string;
  senderName?: string;
  recipientEmail?: string;
  recipientName?: string;
  /** Required for 'cancelled' status */
  businessName?: string;
  amount?: number;
  wasRefunded?: boolean;
  reason?: string;
};

export type OrderStatusEmailJobData = {
  kind: 'sender' | 'recipient';
  to: string;
  name: string;
  referenceCode: string;
  status: string;
  /** Present for 'cancelled' status */
  businessName?: string;
  amount?: number;
  wasRefunded?: boolean;
  reason?: string;
};
