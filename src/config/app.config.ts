export const config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isDev: (process.env.NODE_ENV ?? 'development') === 'development',
  isProd: process.env.NODE_ENV === 'production',
  backendHost: process.env.BACKEND_HOST ?? 'localhost',
  frontendHost: process.env.FRONTEND_HOST ?? '',
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

export function assertConfig(): void {
  const missing: string[] = [];
  if (!config.db.url) missing.push('DATABASE_URL');
  if (!config.frontendHost) missing.push('FRONTEND_HOST');
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}
