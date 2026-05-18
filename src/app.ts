import 'reflect-metadata';
import { randomUUID } from 'crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/app.config';
import { logger } from './config/logger';
import { swaggerSpec } from './config/swagger';
import healthRouter from './modules/health/health.routes';
import { notFound } from './shared/not-found';
import { errorHandler } from './shared/error-handler';
import { buildRateLimiter } from './shared/rate-limit';

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  pinoHttp({
    logger,
    genReqId: (req, res) => {
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

app.use(helmet());
app.use(
  cors({
    origin:
      config.frontendHost.length > 0
        ? (origin, cb) => {
            if (!origin || config.frontendHost.includes(origin)) {
              cb(null, true);
              return;
            }
            cb(new Error('Not allowed by CORS'));
          }
        : false,
  }),
);
app.use(buildRateLimiter());
app.use(express.json({ limit: '1mb' }));

app.use(
  '/docs',
  helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }),
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec),
);
app.use('/health', healthRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
