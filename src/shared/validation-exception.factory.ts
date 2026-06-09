import type { ValidationError } from 'class-validator';
import { HttpError } from './http-error';

// Turns class-validator errors into the same payload zod's flatten() produced,
// so the VALIDATION_FAILED error body shape is unchanged for clients:
//   { formErrors: [], fieldErrors: { field: [messages] } }
export function validationExceptionFactory(errors: ValidationError[]): HttpError {
  const fieldErrors: Record<string, string[]> = {};

  const visit = (errs: ValidationError[], prefix = ''): void => {
    for (const e of errs) {
      const key = prefix ? `${prefix}.${e.property}` : e.property;
      if (e.constraints) fieldErrors[key] = Object.values(e.constraints);
      if (e.children?.length) visit(e.children, key);
    }
  };
  visit(errors);

  return new HttpError(400, 'VALIDATION_FAILED', 'Request validation failed', {
    formErrors: [],
    fieldErrors,
  });
}
