/**
 * Website content reads come mostly from the website's server (rendering and revalidating every
 * page), so they share one IP; they get a higher limit than the global 100 / minute.
 */
export const CONTENT_READ_THROTTLE = { default: { limit: 600, ttl: 60_000 } };
