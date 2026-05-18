import { pino } from 'pino';
import { config } from './app.config';

const level = config.nodeEnv === 'test' ? 'silent' : config.isDev ? 'debug' : 'info';

export const logger = pino({
  level,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token'],
    censor: '[REDACTED]',
  },
  ...(config.isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname' },
        },
      }
    : {}),
});
