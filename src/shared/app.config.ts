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
    // SMTP (prod = SES; local = Mailpit catcher; tests = unset → mocked).
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_SECURE: z
      .string()
      .default('false')
      .transform((v) => v === 'true'),
    // SES configuration set (prod). Sent as the X-SES-CONFIGURATION-SET header so
    // SES publishes send/delivery/bounce/complaint events to CloudWatch. Unset
    // locally (Mailpit) → header omitted.
    SMTP_CONFIGURATION_SET: z.string().optional(),
    EMAIL_FROM: z.string().min(1, 'EMAIL_FROM is required'),
    COOKIE_DOMAIN: z.string().optional(),
    TURNSTILE_SECRET_KEY: z.string().optional(),
    // Escape hatch for testing protected endpoints (e.g. Swagger /docs on
    // production) where no real Turnstile widget is rendered. When set, sending
    // this exact value as `cf-turnstile-response` skips Cloudflare verification.
    // Must be a long, unguessable secret; rotate to revoke.
    TURNSTILE_BYPASS_TOKEN: z.string().min(16).optional(),
    // S3 (local = MiniStack via S3_ENDPOINT; prod = real AWS, endpoint omitted →
    // SDK default chain / EC2 IAM role). Access keys optional (unset in prod).
    S3_BUCKET: z.string().min(1, 'S3_BUCKET is required'),
    S3_REGION: z.string().min(1).default('eu-central-1'),
    S3_ENDPOINT: z.string().url().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_PUBLIC_URL: z.string().url('S3_PUBLIC_URL must be a URL'),
    S3_FORCE_PATH_STYLE: z
      .string()
      .default('false')
      .transform((v) => v === 'true'),
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
    // Production must have an SMTP host configured (fail fast instead of silently
    // mocking email). Auth (SMTP_USER/PASS) is optional here — SES requires it and
    // rejects at send time if absent, while the local Mailpit catcher (which also
    // runs NODE_ENV=production) needs no auth.
    if (e.NODE_ENV === 'production' && !e.SMTP_HOST) {
      ctx.addIssue({ code: 'custom', path: ['SMTP_HOST'], message: 'SMTP_HOST is required in production' });
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
      host: e.SMTP_HOST,
      port: e.SMTP_PORT,
      user: e.SMTP_USER,
      pass: e.SMTP_PASS,
      secure: e.SMTP_SECURE,
      from: e.EMAIL_FROM,
      configurationSet: e.SMTP_CONFIGURATION_SET,
    },
    cookieDomain: e.COOKIE_DOMAIN,
    turnstile: {
      secretKey: e.TURNSTILE_SECRET_KEY,
      bypassToken: e.TURNSTILE_BYPASS_TOKEN,
    },
    s3: {
      bucket: e.S3_BUCKET,
      region: e.S3_REGION,
      endpoint: e.S3_ENDPOINT,
      accessKeyId: e.S3_ACCESS_KEY_ID,
      secretAccessKey: e.S3_SECRET_ACCESS_KEY,
      publicUrl: e.S3_PUBLIC_URL,
      forcePathStyle: e.S3_FORCE_PATH_STYLE,
    },
  };
}

export { loadConfig };

export const config = loadConfig();
