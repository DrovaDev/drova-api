import {
  Global,
  Inject,
  Logger,
  Module,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { buildRedisConnectionOptions } from './queues.redis';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: buildRedisConnectionOptions(configService),
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: 100,
        },
      }),
    }),
  ],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const connectionOpts = buildRedisConnectionOptions(configService);
        return new Redis(connectionOpts);
      },
    },
  ],
  exports: [BullModule, REDIS_CLIENT],
})
export class QueuesModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueuesModule.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
  ) {}

  async onModuleInit() {
    try {
      const connectionOpts = buildRedisConnectionOptions(this.configService);
      const pong = await this.redisClient.ping();
      this.logger.log(
        `Redis connected successfully (${connectionOpts.host}:${connectionOpts.port}) — PING: ${pong}`,
      );

      // BullMQ requires noeviction to prevent job loss
      try {
        const currentPolicy = await this.redisClient.config(
          'GET',
          'maxmemory-policy',
        );
        const policy = currentPolicy?.[1];
        if (policy && policy !== 'noeviction') {
          try {
            await this.redisClient.config(
              'SET',
              'maxmemory-policy',
              'noeviction',
            );
            this.logger.warn(
              `Redis maxmemory-policy was "${policy}", changed to "noeviction"`,
            );
          } catch {
            this.logger.warn(
              `Redis maxmemory-policy is "${policy}" (should be "noeviction"). CONFIG SET not permitted — update this in your Redis provider dashboard.`,
            );
          }
        }
      } catch {
        this.logger.warn(
          'Unable to verify Redis maxmemory-policy (CONFIG command not permitted). Ensure it is set to "noeviction" in your Redis provider dashboard.',
        );
      }
    } catch (error) {
      const connectionOpts = buildRedisConnectionOptions(this.configService);
      this.logger.error(
        `Redis connection failed (${connectionOpts.host}:${connectionOpts.port})`,
        error as any,
      );
    }
  }

  async onModuleDestroy() {
    try {
      await this.redisClient.quit();
    } catch {
      // ignore
    }
  }
}
