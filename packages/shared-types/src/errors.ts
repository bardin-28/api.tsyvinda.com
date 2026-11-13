/** Every API error body: `{ error: { code, message, details?, requestId? } }`. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: {
      /** Per field: messages (DTO validation) or one message (CMS content paths) */
      fieldErrors?: Record<string, string | string[] | undefined>;
      [key: string]: unknown;
    };
    requestId?: string;
  };
}
