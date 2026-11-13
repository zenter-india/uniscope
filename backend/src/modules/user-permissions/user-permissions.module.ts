import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { UserPermissionsController } from './user-permissions.controller.js';
import { UserPermissionsService } from './user-permissions.service.js';

/** Admin management of per-user app permissions. Enforcement lives at each
 * action via assertPermission() (common/helpers/user-permissions.helper.ts),
 * which needs no module wiring. */
@Module({
  imports: [PrismaModule],
  controllers: [UserPermissionsController],
  providers: [UserPermissionsService],
})
export class UserPermissionsModule {}
