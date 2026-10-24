import path from 'path';
import dotenv from 'dotenv';

// One .env at the monorepo root (be/.env), whatever the cwd (pnpm --filter runs in apps/api).
// Same depth from src/shared and dist/shared; in containers the file is absent and env comes from the runtime.
dotenv.config({ path: path.resolve(__dirname, '../../../../.env'), quiet: true });
