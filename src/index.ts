import 'dotenv/config';
import type { Server } from 'http';
import app from './app';
import { config, assertConfig } from './config/app.config';
import { AppDataSource } from './config/database';
import { redis } from './config/redis';

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function init(): Promise<void> {
  assertConfig();

  await AppDataSource.initialize();
  console.log('Database connected');

  await redis.connect();
  console.log('Redis connected');

  const server: Server = app.listen(config.port, () => {
    console.log(`Server listening on port ${config.port}`);
    if (config.isDev) {
      console.log(`Docs → https://${config.backendHost}/docs`);
    }
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`${signal} received, shutting down`);

    const forceExit = setTimeout(() => {
      console.error('Forced exit after shutdown timeout');
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
      console.error('Shutdown error:', err);
      clearTimeout(forceExit);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

init().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
