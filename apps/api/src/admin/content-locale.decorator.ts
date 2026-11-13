import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  CONTENT_LOCALE_HEADER,
  DEFAULT_LOCALE,
  LOCALES,
  isLocale,
  type Locale,
} from '@tsyvinda/shared-types';
import { HttpError } from '../shared/http-error';

/** Reads the language being edited from `X-Content-Locale`; English when the header is absent. */
export function readContentLocale(header: string | string[] | undefined): Locale {
  const value = Array.isArray(header) ? header[0] : header;
  if (value === undefined || value === '') return DEFAULT_LOCALE;
  if (!isLocale(value)) {
    throw new HttpError(
      400,
      'INVALID_LOCALE',
      `${CONTENT_LOCALE_HEADER} must be one of: ${LOCALES.join(', ')}`,
    );
  }
  return value;
}

/** Handler parameter: the admin panel's content language for this request. */
export const ContentLocale = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Locale =>
    readContentLocale(context.switchToHttp().getRequest<Request>().headers[CONTENT_LOCALE_HEADER]),
);

/** Swagger: documents the content-language header on a controller. */
export const ApiContentLocaleHeader = (): ClassDecorator & MethodDecorator =>
  ApiHeader({
    name: CONTENT_LOCALE_HEADER,
    required: false,
    enum: LOCALES,
    description: 'Language of the translated fields to read or write (default en)',
  });
