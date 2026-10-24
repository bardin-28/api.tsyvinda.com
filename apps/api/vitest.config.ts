import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

export default defineConfig({
  // SWC emits the decorator metadata (design:paramtypes) that NestJS DI requires.
  // Vitest's default esbuild transform does not, which would break injection.
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://test:test@localhost:5432/test',
      REDIS_URL: 'redis://localhost:6379',
      JWT_ACCESS_SECRET: 'test-secret-test-secret-test-secret-32',
      RESEND_API_KEY: 'test',
      EMAIL_FROM: 'Blog <noreply@example.com>',
      BCRYPT_COST: '4',
      S3_BUCKET: 'test-bucket',
      S3_PUBLIC_URL: 'http://localhost:4566/test-bucket',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
    },
  },
});
