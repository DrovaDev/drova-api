import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class RiderLocationThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    const riderId = req?.auth?.riderId;
    if (riderId) {
      return Promise.resolve(`rider:${riderId}`);
    }

    const ip = req?.ip;
    return Promise.resolve(ip ?? 'unknown');
  }
}
