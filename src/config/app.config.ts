import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isDev: (process.env.NODE_ENV ?? 'development') === 'development',
  backendHost: process.env.BACKEND_HOST ?? 'localhost',
  db: {
    url: process.env.DATABASE_URL ?? '',
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  ssl: {
    keyPath: process.env.SSL_KEY_PATH ?? 'certs/key.pem',
    certPath: process.env.SSL_CERT_PATH ?? 'certs/cert.pem',
  },
};
