import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  await app.listen(port);

  new Logger('Bootstrap').log(
    `Uniscope API listening on http://localhost:${port}/${apiPrefix}`,
  );
}
void bootstrap();
