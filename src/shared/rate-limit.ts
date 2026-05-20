import rateLimit, { type Options } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import { redis } from '../config/redis';

const DEFAULT_WINDOW_MS = 60 * 1000;
const DEFAULT_LIMIT = 100;

export function buildRateLimiter(overrides: Partial<Options> = {}, prefix: string = 'rl:') {
  return rateLimit({
    windowMs: DEFAULT_WINDOW_MS,
    limit: DEFAULT_LIMIT,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: new RedisStore({
      sendCommand: (...args: string[]) => {
        const [cmd, ...rest] = args;
        if (!cmd) return Promise.resolve(null) as unknown as Promise<RedisReply>;
        return redis.call(cmd, ...rest) as Promise<RedisReply>;
      },
      prefix,
    }),
    ...overrides,
  });
}
