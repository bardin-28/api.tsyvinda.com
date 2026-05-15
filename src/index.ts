import 'dotenv/config';
import app from './app';
import { config } from './config/app.config';
import { AppDataSource } from './config/database';
import { redis } from './config/redis';

async function init(): Promise<void> {
  await AppDataSource.initialize();
  console.log('Database connected');

  await redis.connect();
  console.log('Redis connected');

  app.listen(config.port, () => {
    console.log(`Server listening on port ${config.port}`);

    if (config.isDev) {
      console.log(`Docs → https://${config.backendHost}/docs`);
    }
  });
}

init().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
