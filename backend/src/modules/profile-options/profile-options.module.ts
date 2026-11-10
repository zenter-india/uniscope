import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { AdminCustomDegreesController } from './admin-custom-degrees.controller.js';
import { CustomDegreesService } from './custom-degrees.service.js';
import { ProfileOptionsController } from './profile-options.controller.js';
import {
  AdminSpecializationSuggestionsController,
  SpecializationSuggestionsController,
} from './specialization-suggestions.controller.js';
import { SpecializationSuggestionsService } from './specialization-suggestions.service.js';

/** Profile-creation options that grow from what users type under "Others":
 * degrees/courses, and the specializations a college's own list is built from.
 * User-facing GET/POST + ADMIN approve/reject. */
@Module({
  imports: [PrismaModule],
  controllers: [
    ProfileOptionsController,
    AdminCustomDegreesController,
    SpecializationSuggestionsController,
    AdminSpecializationSuggestionsController,
  ],
  providers: [CustomDegreesService, SpecializationSuggestionsService],
})
export class ProfileOptionsModule {}
