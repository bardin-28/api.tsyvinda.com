import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import healthRouter from './modules/health/health.routes';

const app = express();

app.use(cors({ origin: process.env.FRONTEND_HOST }));
app.use(rateLimit({ windowMs: 1 * 60 * 1000, limit: 100 }));
app.use(express.json());

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/health', healthRouter);

export default app;
