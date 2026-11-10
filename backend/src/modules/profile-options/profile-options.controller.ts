import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { CUSTOM_DEGREE_STREAMS } from './custom-degree-streams.js';
import { CustomDegreesService } from './custom-degrees.service.js';
import { SubmitCustomDegreeDto } from './dto/submit-custom-degree.dto.js';

/** Profile-creation picklists that grow from what users type under "Others".
 * Any authenticated user (profile creation happens after login). */
@UseGuards(JwtAuthGuard)
@Controller('profile-options/degrees')
export class ProfileOptionsController {
  constructor(private readonly degrees: CustomDegreesService) {}

  /** Admin-approved custom degrees for a stream — shown before "Others". */
  @Get()
  async approved(@Query('stream') stream?: string): Promise<string[]> {
    if (!stream || !CUSTOM_DEGREE_STREAMS.includes(stream)) {
      throw new BadRequestException('stream must be one of the app streams');
    }
    return this.degrees.listApprovedNames(stream);
  }

  /** A degree typed under "Others" — queued for admin approval. */
  @Post()
  submit(@CurrentUser() user: JwtPayload, @Body() dto: SubmitCustomDegreeDto) {
    return this.degrees.submit(user.sub, dto);
  }
}
