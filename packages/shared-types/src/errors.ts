/** Every API error body: `{ error: { code, message, details?, requestId? } }`. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: {
      fieldErrors?: Record<string, string[] | undefined>;
      [key: string]: unknown;
    };
    requestId?: string;
  };
}
