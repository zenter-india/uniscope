import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { AdminCustomDegreesController } from './admin-custom-degrees.controller.js';
import { CustomDegreesService } from './custom-degrees.service.js';
import { ProfileOptionsController } from './profile-options.controller.js';

/** Profile-creation options that grow from what users type under "Others"
 * (today: degree/course). User-facing GET/POST + ADMIN approve/reject. */
@Module({
  imports: [PrismaModule],
  controllers: [ProfileOptionsController, AdminCustomDegreesController],
  providers: [CustomDegreesService],
})
export class ProfileOptionsModule {}
