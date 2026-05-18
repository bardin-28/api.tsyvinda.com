import 'dotenv/config';
import type { Server } from 'http';
import app from './app';
import { config } from './config/app.config';
import { AppDataSource } from './config/database';
import { logger } from './config/logger';
import { redis } from './config/redis';

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function init(): Promise<void> {
  await AppDataSource.initialize();
  logger.info('Database connected');

  await redis.ping();
  logger.info('Redis connected');

  const server: Server = app.listen(config.port, () => {
    logger.info({ port: config.port }, 'Server listening');
    if (config.isDev) {
      logger.info(`Docs → https://${config.backendHost}/docs`);
    }
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutdown received');

    const forceExit = setTimeout(() => {
      logger.error('Forced exit after shutdown timeout');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    try {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      await AppDataSource.destroy();
      await redis.quit();
      clearTimeout(forceExit);
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'shutdown error');
      clearTimeout(forceExit);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

init().catch((err) => {
  logger.error({ err }, 'Bootstrap failed');
  process.exit(1);
});
