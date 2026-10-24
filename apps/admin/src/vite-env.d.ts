/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API admin surface base, e.g. https://api.tsyvinda.com/admin */
  readonly ADMIN_PUBLIC_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
