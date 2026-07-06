import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  INombaResponse,
  INombaAccessToken,
  ICreateNombaCheckoutOrder,
  INombaCheckoutOrderResult,
  IVerifyNombaTransaction,
  IRefundNombaCheckoutOrder,
  INombaBank,
  ILookupNombaBankAccount,
  INombaBankAccountDetails,
  ITransferToNombaBank,
  INombaWebhookPayload,
} from '../interfaces/nomba.interface';

@Injectable()
export class NombaService {
  private readonly logger = new Logger(NombaService.name);
  private readonly client: AxiosInstance;
  private readonly baseURL: string;
  private readonly accountId: string;
  private readonly subAccountId: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly configService: ConfigService) {
    this.baseURL =
      this.configService.get('NOMBA_BASE_URL') ?? 'https://api.nomba.com';
    this.accountId = this.configService.get('NOMBA_ACCOUNT_ID') ?? '';
    this.subAccountId = this.configService.get('NOMBA_SUB_ACCOUNT_ID') ?? '';
    this.clientId = this.configService.get('NOMBA_CLIENT_ID') ?? '';
    this.clientSecret = this.configService.get('NOMBA_CLIENT_SECRET') ?? '';

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
        accountId: this.accountId,
      },
    });

    this.client.interceptors.request.use(async (config) => {
      const token = await this.getAccessToken();
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    try {
      const response = await axios.post<INombaResponse<INombaAccessToken>>(
        `${this.baseURL}/v1/auth/token/issue`,
        {
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            accountId: this.accountId,
          },
        },
      );

      const { access_token, expiresAt } = response.data.data;
      this.accessToken = access_token;
      this.tokenExpiresAt = expiresAt
        ? new Date(expiresAt).getTime() - 60_000
        : Date.now() + 25 * 60_000;

      return this.accessToken;
    } catch (error) {
      this.logger.error('Failed to obtain Nomba access token', error);
      throw new InternalServerErrorException(
        'Failed to authenticate with Nomba',
      );
    }
  }

  async createCheckoutOrder(
    payload: ICreateNombaCheckoutOrder,
  ): Promise<INombaCheckoutOrderResult> {
    try {
      const response = await this.client.post<
        INombaResponse<INombaCheckoutOrderResult>
      >('/v1/checkout/order', {
        order: {
          currency: 'NGN',
          callbackUrl: this.configService.get('NOMBA_PAYMENT_REDIRECT_URL'),
          accountId: this.subAccountId,
          ...payload,
        },
      });

      this.logger.log(
        `Checkout order created: ${response.data.data.orderReference}`,
      );
      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to create checkout order', error);
      throw error;
    }
  }

  async verifyTransaction(
    opts: IVerifyNombaTransaction,
  ): Promise<Record<string, any>> {
    try {
      const response = await this.client.get<INombaResponse>(
        '/v1/transactions/accounts/single',
        { params: opts },
      );
      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to verify transaction', error);
      throw error;
    }
  }

  async refundCheckoutOrder(
    payload: IRefundNombaCheckoutOrder,
  ): Promise<Record<string, any>> {
    try {
      const response = await this.client.post<INombaResponse>(
        '/v1/checkout/refund',
        payload,
      );
      this.logger.log(
        `Refund processed for transaction ${payload.transactionId}`,
      );
      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to refund checkout order', error);
      throw error;
    }
  }

  async fetchBanks(): Promise<INombaBank[]> {
    try {
      const response = await this.client.get<INombaResponse<INombaBank[]>>(
        '/v1/transfers/banks',
      );
      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to fetch banks', error);
      throw error;
    }
  }

  async lookupBankAccount(
    payload: ILookupNombaBankAccount,
  ): Promise<INombaBankAccountDetails> {
    try {
      const response = await this.client.post<
        INombaResponse<INombaBankAccountDetails>
      >('/v1/transfers/bank/lookup', payload);
      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to lookup bank account', error);
      throw error;
    }
  }

  async transferToBank(
    payload: ITransferToNombaBank,
  ): Promise<Record<string, any>> {
    try {
      const response = await this.client.post<INombaResponse>(
        `/v2/transfers/bank/${this.subAccountId}`,
        payload,
      );
      this.logger.log(
        `Bank transfer initiated: ${payload.merchantTxRef} (status: ${response.data.data?.status})`,
      );
      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to transfer to bank', error);
      throw error;
    }
  }

  async getAccountBalance(): Promise<Record<string, any>> {
    try {
      const response = await this.client.get<INombaResponse>(
        `/v1/accounts/${this.subAccountId}/balance`,
      );
      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to fetch account balance', error);
      throw error;
    }
  }

  verifyWebhookSignature(
    payload: INombaWebhookPayload,
    headers: Record<string, string>,
  ): boolean {
    const signatureKey = this.configService.get('NOMBA_WEBHOOK_SIGNATURE_KEY');
    const nombaTimestamp = headers['nomba-timestamp'];
    const receivedSignature = headers['nomba-signature'];

    if (!signatureKey || !nombaTimestamp || !receivedSignature) {
      return false;
    }

    const signatureInput = [
      payload.event_type,
      payload.requestId,
      payload.data?.merchant?.userId,
      payload.data?.merchant?.walletId,
      payload.data?.transaction?.transactionId,
      payload.data?.transaction?.type,
      payload.data?.transaction?.time,
      payload.data?.transaction?.responseCode,
      nombaTimestamp,
    ].join(':');

    const expectedSignature = createHmac('sha256', signatureKey)
      .update(signatureInput)
      .digest('base64');

    const expected = Buffer.from(expectedSignature);
    const received = Buffer.from(receivedSignature);

    return (
      expected.length === received.length && timingSafeEqual(expected, received)
    );
  }
}
