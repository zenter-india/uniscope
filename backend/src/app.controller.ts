import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * TEMPORARY — added 2026-09-19 solely to confirm the new Sentry wiring
   * (see instrument.ts + SentryExceptionFilter) is actually reaching a
   * real Sentry project end to end. Deliberately throws an unhandled
   * error, which SentryExceptionFilter reports before Nest's default 500
   * response goes out — hit this once, see it land in Sentry's Issues
   * tab, then this route should be deleted (it serves no product purpose
   * and there's no reason to leave a "throw an error on demand" endpoint
   * reachable in production once its one job is done).
   */
  @Get('debug-sentry')
  debugSentry(): never {
    throw new Error('Sentry test error — thrown on purpose from GET /debug-sentry');
  }
}
