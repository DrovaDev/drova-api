import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class NeuronService {
  private readonly logger = new Logger(NeuronService.name);
  private readonly client: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('NEURON_API_KEY') ?? '';

    this.client = axios.create({
      baseURL: 'https://api.neuron.ng/api/v1',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });
  }

  async sendWhatsAppMessage(to: string, message: string): Promise<void> {
    try {
      await this.client.post('/bot-api/send', { to, message });
      this.logger.log(`WhatsApp message sent to ${to}`);
    } catch (error) {
      this.logger.error(
        `Failed to send WhatsApp message to ${to}`,
        error?.response?.data ?? error,
      );
    }
  }
}
