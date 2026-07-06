import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';

type MessageHandler = (topic: string, payload: Buffer) => void;

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client: mqtt.MqttClient | null = null;
  private readonly handlers = new Map<string, MessageHandler[]>();

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const host = this.configService.get<string>('MQTT_HOST');
    const port = Number(this.configService.get<string>('MQTT_PORT') ?? '8883');
    const username = this.configService.get<string>('MQTT_USERNAME');
    const password = this.configService.get<string>('MQTT_PASSWORD');

    if (!host || !username || !password) {
      this.logger.warn(
        'MQTT config incomplete (MQTT_HOST / MQTT_USERNAME / MQTT_PASSWORD) — MQTT disabled',
      );
      return;
    }

    this.client = mqtt.connect(`mqtts://${host}:${port}`, {
      username,
      password,
      clientId: `drova-backend-${Date.now()}`,
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 10_000,
      // HiveMQ Cloud uses a publicly trusted TLS certificate
      rejectUnauthorized: true,
    });

    this.client.on('connect', () => {
      this.logger.log('Connected to MQTT broker');
      for (const topic of this.handlers.keys()) {
        this.client!.subscribe(topic, { qos: 1 }, (err) => {
          if (err) this.logger.error(`Failed to subscribe to ${topic}`, err);
          else this.logger.log(`Subscribed to ${topic}`);
        });
      }
    });

    this.client.on('message', (topic, payload) => {
      for (const [pattern, handlers] of this.handlers.entries()) {
        if (this.matchesTopic(topic, pattern)) {
          for (const handler of handlers) {
            handler(topic, payload);
          }
        }
      }
    });

    this.client.on('error', (err) => this.logger.error('MQTT error', err));
    this.client.on('reconnect', () => this.logger.warn('MQTT reconnecting...'));
    this.client.on('disconnect', () => this.logger.warn('MQTT disconnected'));
  }

  onModuleDestroy(): void {
    this.client?.end();
  }

  subscribe(topicPattern: string, handler: MessageHandler): void {
    if (!this.handlers.has(topicPattern)) {
      this.handlers.set(topicPattern, []);
      if (this.client?.connected) {
        this.client.subscribe(topicPattern, { qos: 1 }, (err) => {
          if (err) {
            this.logger.error(`Failed to subscribe to ${topicPattern}`, err);
          }
        });
      }
    }
    this.handlers.get(topicPattern)!.push(handler);
  }

  publish(topic: string, payload: object): void {
    if (!this.client?.connected) {
      this.logger.warn(`MQTT not connected — dropping publish to ${topic}`);
      return;
    }
    this.client.publish(topic, JSON.stringify(payload), { qos: 1 });
  }

  // Converts MQTT wildcard pattern to a regex and tests the topic against it.
  private matchesTopic(topic: string, pattern: string): boolean {
    const regex = new RegExp(
      `^${pattern.replaceAll('+', '[^/]+').replaceAll('#', '.+')}$`,
    );
    return regex.test(topic);
  }
}
