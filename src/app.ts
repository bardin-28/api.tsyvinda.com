import 'reflect-metadata';
import { randomUUID } from 'crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { config } from './shared/app.config';
import { logger } from './shared/logger';
import { swaggerSpec } from './shared/swagger';
import authRouter from './modules/auth/auth.routes';
import healthRouter from './modules/health/health.routes';
import usersRouter from './modules/users/users.routes';
import { UPLOAD_DIR as PROFILE_UPLOAD_DIR } from './modules/users/shared/upload';
import postsRouter from './modules/posts/posts.routes';
import { UPLOAD_DIR as POST_UPLOAD_DIR } from './modules/posts/shared/upload';
import { HttpError } from './shared/http-error';
import { notFound } from './shared/not-found';
import { errorHandler } from './shared/error-handler';
import { buildRateLimiter } from './shared/rate-limit';

const allowedOrigins = new Set<string>([
  ...config.frontendHost,
  `https://${config.backendHost}`,
]);

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
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.has(origin)) {
        cb(null, true);
        return;
      }
      cb(new HttpError(403, 'CORS_DENIED', `Origin ${origin} is not allowed`));
    },
    credentials: true,
  }),
);
app.use(buildRateLimiter());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use(
  '/docs',
  helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }),
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec),
);
app.use(
  '/uploads/profile',
  express.static(PROFILE_UPLOAD_DIR, {
    fallthrough: false,
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  }),
);
app.use(
  '/uploads/posts',
  express.static(POST_UPLOAD_DIR, {
    fallthrough: false,
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  }),
);
app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/', usersRouter);
app.use('/posts', postsRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
