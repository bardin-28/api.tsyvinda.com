import { z } from 'zod';

const envSchema = z
  .object({
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
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
    JWT_ACCESS_TTL: z.string().min(1).default('15m'),
    REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
    BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),
    RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
    EMAIL_FROM: z.string().min(1, 'EMAIL_FROM is required'),
    COOKIE_DOMAIN: z.string().optional(),
    TURNSTILE_SECRET_KEY: z.string().optional(),
    // Escape hatch for testing protected endpoints (e.g. Swagger /docs on
    // production) where no real Turnstile widget is rendered. When set, sending
    // this exact value as `cf-turnstile-response` skips Cloudflare verification.
    // Must be a long, unguessable secret; rotate to revoke.
    TURNSTILE_BYPASS_TOKEN: z.string().min(16).optional(),
  })
  .superRefine((e, ctx) => {
    // Cloudflare Turnstile is mandatory in production: a missing secret there means
    // every protected endpoint would silently skip verification. Fail fast on boot
    // instead. In development/test the secret is optional and verification is skipped.
    if (e.NODE_ENV === 'production' && !e.TURNSTILE_SECRET_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['TURNSTILE_SECRET_KEY'],
        message: 'TURNSTILE_SECRET_KEY is required in production',
      });
    }
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
    auth: {
      jwtAccessSecret: e.JWT_ACCESS_SECRET,
      jwtAccessTtl: e.JWT_ACCESS_TTL,
      refreshTtlDays: e.REFRESH_TTL_DAYS,
      bcryptCost: e.BCRYPT_COST,
    },
    email: {
      resendApiKey: e.RESEND_API_KEY,
      from: e.EMAIL_FROM,
    },
    cookieDomain: e.COOKIE_DOMAIN,
    turnstile: {
      secretKey: e.TURNSTILE_SECRET_KEY,
      bypassToken: e.TURNSTILE_BYPASS_TOKEN,
    },
  };
}

export { loadConfig };

export const config = loadConfig();
