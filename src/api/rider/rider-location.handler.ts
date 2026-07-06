import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Point } from 'typeorm';
import { MqttService } from 'src/mqtt/mqtt.service';
import { RiderDb } from './rider.db';

@Injectable()
export class RiderLocationHandler implements OnModuleInit {
  private readonly logger = new Logger(RiderLocationHandler.name);

  // riders/{businessId}/{riderId}/location
  private static readonly TOPIC = 'riders/+/+/location';

  constructor(
    private readonly mqttService: MqttService,
    private readonly riderDb: RiderDb,
  ) {}

  onModuleInit(): void {
    this.mqttService.subscribe(
      RiderLocationHandler.TOPIC,
      this.handle.bind(this),
    );
  }

  private async handle(topic: string, raw: Buffer): Promise<void> {
    const segments = topic.split('/');
    if (segments.length !== 4) return;

    const [, businessId, riderId] = segments;

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw.toString());
    } catch {
      this.logger.warn(`Malformed JSON on topic ${topic}`);
      return;
    }

    const latitude = Number(payload.latitude);
    const longitude = Number(payload.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      this.logger.warn(
        `Invalid coordinates from riderId=${riderId}: lat=${payload.latitude} lng=${payload.longitude}`,
      );
      return;
    }

    if (
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      this.logger.warn(
        `Out-of-range coordinates from riderId=${riderId}: lat=${latitude} lng=${longitude}`,
      );
      return;
    }

    const rider = await this.riderDb.findRiderById(businessId, riderId);
    if (!rider) {
      this.logger.warn(
        `Unknown rider on location update: businessId=${businessId} riderId=${riderId}`,
      );
      return;
    }

    const location: Point = {
      type: 'Point',
      coordinates: [longitude, latitude],
    };
    rider.lastKnownLocation = location;
    rider.lastLocationUpdatedAt = new Date();
    await this.riderDb.saveRider(rider);
  }
}
