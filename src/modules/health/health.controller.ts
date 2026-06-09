import { Controller, Get, Inject, Res } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { DataSource } from 'typeorm';
import type { Redis } from 'ioredis';
import { REDIS } from '../../redis/redis.module';
import { logger } from '../../shared/logger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get()
  async check(@Res() res: Response): Promise<void> {
    let dbOk = false;
    try {
      if (this.ds.isInitialized) {
        await this.ds.query('SELECT 1');
        dbOk = true;
      }
    } catch (err) {
      logger.warn({ err }, 'health: db check failed');
    }

    let redisOk = false;
    try {
      const pong = await this.redis.ping();
      redisOk = pong === 'PONG';
    } catch (err) {
      logger.warn({ err }, 'health: redis check failed');
    }

    const ok = dbOk && redisOk;
    res.status(ok ? 200 : 503).json({
      status: ok ? 'ok' : 'degraded',
      db: dbOk,
      redis: redisOk,
    });
  }
}
