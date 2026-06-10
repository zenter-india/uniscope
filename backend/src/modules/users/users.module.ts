import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';

/**
 * UsersModule owns all user-related domain logic:
 * user profile management, role transitions, account settings,
 * and soft-delete / account closure workflows.
 */
@Module({
  imports: [PrismaModule],
  controllers: [], // Sprint 1: add UsersController
  providers: [], // Sprint 1: add UsersService
  exports: [],
})
export class UsersModule {}
