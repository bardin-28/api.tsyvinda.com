import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// One .env at the monorepo root. Only ADMIN_PUBLIC_* reaches the browser bundle.
const ENV_DIR = fileURLToPath(new URL('../../', import.meta.url));
const ENV_PREFIX = 'ADMIN_PUBLIC_';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ENV_DIR, '');

  return {
    envDir: ENV_DIR,
    envPrefix: ENV_PREFIX,
    plugins: [react()],
    resolve: {
      alias: {
        // Source, not dist: no shared-types rebuild needed while the panel hot-reloads.
        '@tsyvinda/shared-types': fileURLToPath(
          new URL('../../packages/shared-types/src/index.ts', import.meta.url),
        ),
      },
    },
    // react-admin + MUI land in one ~900 kB chunk; code-split once there are resource pages.
    build: { chunkSizeWarningLimit: 1200 },
    server: {
      port: env['ADMIN_PORT'] ? parseInt(env['ADMIN_PORT'], 10) : 5173,
      // Host run: IPv4 loopback (Vite's "localhost" can bind ::1 only). The compose container
      // sets ADMIN_DEV_HOST=0.0.0.0 so nginx-proxy can reach it.
      host: env['ADMIN_DEV_HOST'] || '127.0.0.1',
      allowedHosts: env['ADMIN_HOST'] ? [env['ADMIN_HOST']] : [],
      // Behind nginx-proxy the browser reaches the HMR socket on 443, not Vite's own port.
      hmr: env['ADMIN_DEV_PROXIED'] === 'true' ? { clientPort: 443 } : undefined,
    },
    test: {
      environment: 'jsdom',
      env: { ADMIN_PUBLIC_API_URL: 'http://api.test/admin' },
      globals: true,
      setupFiles: ['./vitest.setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      // RA renders are slow in jsdom on CI runners
      testTimeout: 15000,
      coverage: { provider: 'v8' },
    },
  };
});
