import { Request, Response } from 'express';
import { AppDataSource } from '../../config/database';
import { redis } from '../../config/redis';

export async function healthCheck(_req: Request, res: Response): Promise<void> {
  let dbOk = false;
  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.query('SELECT 1');
      dbOk = true;
    }
  } catch (err) {
    console.warn('health: db check failed', err);
  }

  let redisOk = false;
  try {
    const pong = await redis.ping();
    redisOk = pong === 'PONG';
  } catch (err) {
    console.warn('health: redis check failed', err);
  }

  const ok = dbOk && redisOk;
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    db: dbOk,
    redis: redisOk,
  });
}
