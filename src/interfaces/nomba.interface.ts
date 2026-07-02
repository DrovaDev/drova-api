export interface INombaResponse<T = any> {
  code: string;
  description: string;
  data: T;
}

export interface INombaAccessToken {
  businessId: string;
  access_token: string;
  refresh_token: string;
  expiresAt: string;
}

export interface ICreateNombaCheckoutOrder {
  amount: string | number;
  currency?: string;
  orderReference?: string;
  callbackUrl?: string;
  customerEmail?: string;
  customerId?: string;
  splitRequest?: Record<string, any>;
  orderMetaData?: Record<string, any>;
  allowedPaymentMethods?: string[];
}

export interface INombaCheckoutOrderResult {
  checkoutLink: string;
  orderReference: string;
}

export interface IVerifyNombaTransaction {
  orderReference?: string;
  transactionRef?: string;
}

export interface IRefundNombaCheckoutOrder {
  transactionId: string;
  amount?: number;
  accountNumber?: string;
  bankCode?: string;
}

export interface INombaBank {
  code: string;
  name: string;
}

export interface ILookupNombaBankAccount {
  accountNumber: string;
  bankCode: string;
}

export interface INombaBankAccountDetails {
  accountNumber: string;
  accountName: string;
}

export interface ITransferToNombaBank {
  amount: number;
  accountNumber: string;
  accountName: string;
  bankCode: string;
  merchantTxRef: string;
  senderName?: string;
  narration?: string;
}

export interface INombaWebhookPayload {
  event_type: string;
  requestId: string;
  data: {
    merchant?: {
      walletId?: string;
      walletBalance?: string;
      userId?: string;
    };
    transaction?: {
      transactionId?: string;
      type?: string;
      time?: string;
      responseCode?: string;
      [key: string]: any;
    };
    customer?: Record<string, any>;
    [key: string]: any;
  };
}
