import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  BACKEND_HOST: z.string().min(1).default('localhost'),
  FRONTEND_HOST: z
    .string()
    .default('')
    .transform((s) =>
      s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  SSL_KEY_PATH: z.string().default('certs/key.pem'),
  SSL_CERT_PATH: z.string().default('certs/cert.pem'),
});

export type Env = z.infer<typeof envSchema>;

function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid environment configuration: ${JSON.stringify(issues)}`);
  }
  const e = parsed.data;
  return {
    port: e.PORT,
    nodeEnv: e.NODE_ENV,
    isDev: e.NODE_ENV === 'development',
    isProd: e.NODE_ENV === 'production',
    backendHost: e.BACKEND_HOST,
    frontendHost: e.FRONTEND_HOST,
    db: { url: e.DATABASE_URL },
    redis: { url: e.REDIS_URL },
    ssl: { keyPath: e.SSL_KEY_PATH, certPath: e.SSL_CERT_PATH },
  };
}

export { loadConfig };
export const config = loadConfig();
