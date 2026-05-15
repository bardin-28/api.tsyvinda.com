import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/app.config';
import { swaggerSpec } from './config/swagger';
import healthRouter from './modules/health/health.routes';

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet());
app.use(cors({ origin: config.frontendHost || false }));
app.use(
  rateLimit({ windowMs: 60 * 1000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false }),
);
app.use(express.json({ limit: '1mb' }));

app.use(
  '/docs',
  helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }),
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec),
);
app.use('/health', healthRouter);

export default app;
