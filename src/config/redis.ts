import Redis from 'ioredis';
import { config } from './app.config';

export const redis = new Redis(config.redis.url, {
  lazyConnect: true,
});

redis.on('error', (err) => {
  console.error('Redis error:', err);
});
