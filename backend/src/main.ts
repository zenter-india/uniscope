// Must be the very first import — see instrument.ts's own doc comment for
// why (Sentry instruments other modules as they're required, so it has to
// run before anything else pulls them in).
import './instrument.js';

import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { SentryExceptionFilter } from './common/filters/sentry-exception.filter.js';
import { rejectBrotliRequestBodies } from './common/middleware/reject-brotli-request.middleware.js';

async function bootstrap() {
  // rawBody:true exposes request.rawBody — needed to verify the Razorpay
  // webhook's HMAC signature against the exact bytes Razorpay signed,
  // before the global body parser JSON-decodes (and potentially
  // re-serializes differently from) the payload.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // Refuse Brotli request bodies before any body parser can decode them —
  // a defence against the Node.js Brotli decoder bug (CVE-2026-111497).
  // Order matters: Nest's useBodyParser registers the parser immediately,
  // so this must stay ABOVE it (a test in the middleware's spec checks it).
  app.use(rejectBrotliRequestBodies);

  // Verification document submission sends a base64-encoded photo in the
  // JSON body (simpler than multipart for the mobile Dio client) — bump
  // past Express's 100kb default so a ~5MB image (≈6.7MB base64) fits.
  app.useBodyParser('json', { limit: '10mb' });

  const config = app.get(ConfigService);
  const port = config.get<number>('app.port', 3000);
  const apiPrefix = config.get<string>('app.apiPrefix', 'api/v1');

  // Business routes are served under the API prefix (e.g. /api/v1/auth).
  // `health` is excluded so infra liveness checks can hit /health at the root.
  app.setGlobalPrefix(apiPrefix, { exclude: ['health'] });

  // Allow the mobile web preview / admin to call the API from the browser.
  app.enableCors({ origin: true, credentials: true });

  // Validate and transform all incoming payloads against their DTOs.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Reports every real error (5xx / unhandled) to Sentry before falling
  // through to Nest's normal response formatting — a no-op wrapper when
  // SENTRY_DSN isn't set (see instrument.ts). A global filter needs its
  // httpAdapter passed manually rather than through DI.
  app.useGlobalFilters(new SentryExceptionFilter(app.getHttpAdapter()));

  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`Uniscope API listening on http://localhost:${port}/${apiPrefix}`);
  // Which Node runtime is actually serving — lets the deploy log answer
  // "are we on a patched Node?" without a shell on the host.
  logger.log(`Node.js runtime ${process.version}`);
}
void bootstrap();
