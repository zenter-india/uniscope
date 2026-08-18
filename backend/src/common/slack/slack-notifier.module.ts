import { Module } from '@nestjs/common';
import { SlackNotifierService } from './slack-notifier.service.js';

@Module({
  providers: [SlackNotifierService],
  exports: [SlackNotifierService],
})
export class SlackNotifierModule {}
