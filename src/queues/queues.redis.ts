import { ConfigService } from '@nestjs/config';

export function buildRedisConnectionOptions(configService: ConfigService) {
  const redisUrl = configService.get<string>('REDIS_URL');
  if (!redisUrl) {
    throw new Error('REDIS_URL is not defined');
  }
  const url = new URL(redisUrl);
  const password = url.password ? decodeURIComponent(url.password) : undefined;
  const isTls = url.protocol === 'rediss:';

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : isTls ? 6380 : 6379,
    password,
    ...(isTls ? { tls: {} } : {}),
  };
}
