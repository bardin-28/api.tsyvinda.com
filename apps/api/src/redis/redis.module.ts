import { Global, Module, type OnApplicationShutdown } from '@nestjs/common';
import { redis } from './redis';

// Injection token for the shared ioredis client.
export const REDIS = Symbol('REDIS');

// Wraps the existing ioredis client as a global provider so it can be injected
// (health check, throttler storage) and closed cleanly on shutdown.
@Global()
@Module({
  providers: [{ provide: REDIS, useValue: redis }],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    if (redis.status === 'ready' || redis.status === 'connecting') {
      await redis.quit();
    }
  }
}
