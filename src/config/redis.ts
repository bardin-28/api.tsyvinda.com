import Redis from 'ioredis';
import { config } from './app.config';
import { logger } from './logger';

export const redis = new Redis(config.redis.url, {
  lazyConnect: true,
});

redis.on('error', (err) => {
  logger.error({ err }, 'redis error');
});
