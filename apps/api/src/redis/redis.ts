import Redis from 'ioredis';
import { config } from '../shared/app.config';
import { logger } from '../shared/logger';

export const redis = new Redis(config.redis.url, {
  lazyConnect: true,
});

redis.on('error', (err) => {
  logger.error({ err }, 'redis error');
});
