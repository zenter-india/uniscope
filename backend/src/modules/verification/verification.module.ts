import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';

/**
 * VerificationModule owns mentor identity verification workflows:
 * document submission, Supabase Storage upload, admin review queue,
 * status transitions (DRAFT → SUBMITTED → UNDER_REVIEW → VERIFIED/REJECTED),
 * and user role promotion on approval.
 */
@Module({
  imports: [PrismaModule],
  controllers: [], // Sprint 2: add VerificationController
  providers: [], // Sprint 2: add VerificationService
  exports: [],
})
export class VerificationModule {}
