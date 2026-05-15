import { Request, Response } from 'express';
import { AppDataSource } from '../../config/database';
import { redis } from '../../config/redis';

export async function healthCheck(_req: Request, res: Response): Promise<void> {
  let redisOk = false;
  try {
    await redis.ping();
    redisOk = true;
  } catch {}

  res.json({
    status: 'ok',
    db: AppDataSource.isInitialized,
    redis: redisOk,
  });
}
