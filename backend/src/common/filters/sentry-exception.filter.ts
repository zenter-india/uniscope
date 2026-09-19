import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/node';

/**
 * Global exception filter — reports every real error to Sentry (see
 * instrument.ts), then defers to Nest's own default handling so the HTTP
 * response shape is completely unchanged (this never overrides anything a
 * client sees, only adds a side-effect report).
 *
 * A 4xx `HttpException` (validation failure, 404, a deliberate 409/403,
 * etc.) is expected, everyday API behavior, not a bug — reporting those to
 * Sentry would just be noise drowning out the errors actually worth
 * looking at. Only 5xx HttpExceptions and anything that isn't an
 * HttpException at all (a genuinely unhandled exception) get reported.
 */
@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const isExpectedClientError =
      exception instanceof HttpException && exception.getStatus() < 500;
    if (!isExpectedClientError) {
      Sentry.captureException(exception);
    }
    super.catch(exception, host);
  }
}
