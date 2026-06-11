import 'reflect-metadata';
import 'dotenv/config';
import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import type { Request, Response, NextFunction } from 'express';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { AppModule } from './app.module';
import { config } from './shared/app.config';
import { logger } from './shared/logger';
import { redis } from './redis/redis';
import { HttpError } from './shared/http-error';
import { AllExceptionsFilter } from './shared/all-exceptions.filter';
import { validationExceptionFactory } from './shared/validation-exception.factory';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const allowedOrigins = new Set<string>([...config.frontendHost, `https://${config.backendHost}`]);

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    pinoHttp({
      logger,
      genReqId: (req: IncomingMessage, res: ServerResponse) => {
        const incoming = req.headers['x-request-id'];
        const id = typeof incoming === 'string' && incoming ? incoming : randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );

  // Swagger's inline init script needs a relaxed CSP; keep that exemption scoped
  // to /docs and apply the strict default everywhere else.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const mw = req.path.startsWith('/docs')
      ? helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false })
      : helmet();
    mw(req, res, next);
  });

  app.enableCors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.has(origin)) {
        cb(null, true);
        return;
      }
      cb(new HttpError(403, 'CORS_DENIED', `Origin ${origin} is not allowed`));
    },
    credentials: true,
  });

  app.use(cookieParser());
  app.useBodyParser('json', { limit: '1mb' });

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('API')
    .setVersion('1.0.0')
    .addServer(`https://${config.backendHost}`)
    .addCookieAuth('access', { type: 'apiKey', in: 'cookie', name: 'access' }, 'cookieAuth')
    .build();
  SwaggerModule.setup('/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  app.enableShutdownHooks();

  await redis.ping();
  logger.info('Redis connected');

  await app.listen(config.port, '0.0.0.0');
  logger.info({ port: config.port }, 'Server listening');
  if (config.isDev) {
    logger.info(`Docs → https://${config.backendHost}/docs`);
  }

  // Force-exit watchdog: if graceful close stalls past the timeout, bail hard.
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      const forceExit = setTimeout(() => {
        logger.error('Forced exit after shutdown timeout');
        process.exit(1);
      }, SHUTDOWN_TIMEOUT_MS);
      forceExit.unref();
    });
  }
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Bootstrap failed');
  process.exit(1);
});
