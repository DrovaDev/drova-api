import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkersModule } from './workers/workers.module';
import * as http from 'node:http';
import * as https from 'node:https';

// Minimal health check server — just to satisfy Render's port requirement
const PORT = process.env.PORT || 3001;
http
  .createServer((req, res) => {
    res.writeHead(200);
    res.end('Worker running');
  })
  .listen(PORT, () => {
    console.log(`Health check server listening on port ${PORT}`);
  });
// self ping worker service every 2 minutes
function keepAlive() {
  if (process.env.NODE_ENV === 'production') return;
  const url = process.env.RENDER_EXTERNAL_URL;
  if (!url) {
    console.warn('RENDER_EXTERNAL_URL not set, skipping keep-alive ping');
    return;
  }
  const client = url.startsWith('https') ? https : http;
  setInterval(
    () => {
      client
        .get(url, (res) => {
          console.log(`Keep-alive ping sent — status: ${res.statusCode}`);
        })
        .on('error', (err) => {
          console.error('Keep-alive ping failed:', err.message);
        });
    },
    2 * 60 * 1000,
  ); // every 2 minutes
}

async function bootstrap() {
  const logger = new Logger('WorkerBootstrap');
  const app = await NestFactory.createApplicationContext(WorkersModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  app.enableShutdownHooks();
  keepAlive();
  logger.log('Worker started');
}

bootstrap();
