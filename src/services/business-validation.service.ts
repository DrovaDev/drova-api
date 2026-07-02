import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class BusinessValidationService {
  private readonly logger = new Logger(BusinessValidationService.name);
  private _client: AxiosInstance;
  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>(
      'BUSINESS_VALIDATION_API_KEY',
    );
    const baseURL = this.configService.get<string>(
      'BUSINESS_VALIDATION_API_BASE_URL',
    );
    if (!apiKey || !baseURL) {
      throw new InternalServerErrorException(
        'Business validation API configuration is missing',
      );
    }
    this._client = axios.create({
      baseURL,
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  async lookupBusinessTIN(businessRegNumber: string): Promise<any> {
    try {
      const response = await this._client.post('', {
        rc: businessRegNumber,
        type: '2',
      });
      console.log(response);
      const payload = response?.data;
      console.log(`This is the payload: ${payload}`);
      if (!payload) {
        throw new InternalServerErrorException(
          'Empty response from business validation service',
        );
      }
      if (payload?.success !== true) {
        throw new InternalServerErrorException(
          typeof payload?.message === 'string'
            ? payload.message
            : 'Business validation failed',
        );
      }

      return payload;
    } catch (error) {
      const err = error as any;
      const upstream = err?.response?.data;
      this.logger.error(
        `Failed to lookup business TIN for ${businessRegNumber}`,
        upstream ?? err,
      );
      throw new InternalServerErrorException(
        typeof upstream?.message === 'string'
          ? upstream.message
          : 'Failed to validate business registration number',
      );
    }
  }
}
