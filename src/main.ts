import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, ClassSerializerInterceptor, Logger } from '@nestjs/common';
import { HttpExceptionFilter } from './helpers/exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Request } from 'express';
import morgan from 'morgan';

process.chdir(__dirname);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      disableErrorMessages: false,
      forbidUnknownValues: true,
      errorHttpStatusCode: 422,
    }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization, X-Requested-With',
    credentials: true,
  });

  app.use(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    morgan('combined', {
      skip: (req: Request) => {
        return req.originalUrl === '/';
      },
    }),
  );

  if (process.env.ENABLE_SWAGGER === 'true') {
    const swaggerBuild = new DocumentBuilder()
      .setTitle('Drova Backend API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const swaggerDocument = SwaggerModule.createDocument(app, swaggerBuild);
    SwaggerModule.setup('/api/v1/docs', app, swaggerDocument);
  }

  const PORT = process.env.PORT ?? 3000;
  await app.listen(PORT);
  Logger.log(`Server listening on http://localhost:${PORT}`, 'Bootstrap');
}

bootstrap();
