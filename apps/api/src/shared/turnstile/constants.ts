// Body/form key the frontend sends and Cloudflare's siteverify expects. Shared
// contract with the frontend (`src/shared/turnstile/constants.ts` there).
export const TURNSTILE_TOKEN_FIELD = 'cf-turnstile-response';

// Cloudflare's server-side verification endpoint.
export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Upper bound on how long we wait for siteverify before treating it as unavailable,
// so a hung Cloudflare request never stalls a protected endpoint indefinitely.
export const SITEVERIFY_TIMEOUT_MS = 10_000;
