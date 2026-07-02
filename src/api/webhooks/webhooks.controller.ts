import { Body, Controller, Headers, Post } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import type { INombaWebhookPayload } from 'src/interfaces/nomba.interface';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('nomba')
  handleNombaEvent(
    @Headers() headers: Record<string, string>,
    @Body() payload: INombaWebhookPayload,
  ) {
    return this.webhooksService.handleNombaEvent(payload, headers);
  }
}
