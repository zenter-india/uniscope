import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, VerificationStatus } from '@prisma/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { SUPABASE_BUCKETS, SUPABASE_CLIENT } from '../../supabase/index.js';
import { ReviewVerificationDto } from './dto/review-verification.dto.js';
import { SubmitVerificationDto } from './dto/submit-verification.dto.js';
import {
  toVerificationRequestResponse,
  VerificationRequestResponse,
} from './verification-response.js';

/** Statuses a user may resubmit from — VERIFIED is deliberately excluded
 * (already verified, no reason to resubmit) and SUBMITTED/UNDER_REVIEW are
 * excluded so a user can't spam multiple concurrent requests. */
const RESUBMITTABLE_STATUSES: VerificationStatus[] = [
  VerificationStatus.DRAFT,
  VerificationStatus.REJECTED,
];

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async submit(
    userId: string,
    dto: SubmitVerificationDto,
  ): Promise<VerificationRequestResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!RESUBMITTABLE_STATUSES.includes(user.verificationStatus)) {
      throw new ConflictException(
        `Cannot submit a new verification request while status is ${user.verificationStatus}`,
      );
    }

    const university = await this.prisma.university.findUnique({
      where: { id: dto.universityId },
    });
    if (!university) {
      throw new BadRequestException(`University '${dto.universityId}' not found`);
    }

    const buffer = Buffer.from(dto.documentBase64, 'base64');
    if (buffer.length === 0) {
      throw new BadRequestException('documentBase64 did not decode to any bytes');
    }

    const documentKey = `${userId}/${randomUUID()}.jpg`;
    const { error: uploadError } = await this.supabase.storage
      .from(SUPABASE_BUCKETS.VERIFICATION_DOCS)
      .upload(documentKey, buffer, { contentType: 'image/jpeg', upsert: false });
    if (uploadError) {
      throw new BadRequestException(`Failed to upload document: ${uploadError.message}`);
    }

    const now = new Date();
    const [request] = await this.prisma.$transaction([
      this.prisma.verificationRequest.create({
        data: {
          userId,
          universityId: dto.universityId,
          documentType: dto.documentType,
          documentKey,
          status: VerificationStatus.SUBMITTED,
          submittedAt: now,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { verificationStatus: VerificationStatus.SUBMITTED },
      }),
    ]);

    return toVerificationRequestResponse(request);
  }

  async findMine(userId: string): Promise<VerificationRequestResponse[]> {
    const rows = await this.prisma.verificationRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toVerificationRequestResponse);
  }

  /** Admin queue — SUBMITTED and UNDER_REVIEW requests, oldest first (fair
   * FIFO review order). */
  async findQueue(): Promise<VerificationRequestResponse[]> {
    const rows = await this.prisma.verificationRequest.findMany({
      where: { status: { in: [VerificationStatus.SUBMITTED, VerificationStatus.UNDER_REVIEW] } },
      orderBy: { submittedAt: 'asc' },
      include: {
        user: { select: { displayName: true } },
        university: { select: { name: true } },
      },
    });
    return rows.map(toVerificationRequestResponse);
  }

  /** A time-limited signed URL to view the document image — never expose the
   * raw storage key/bucket path to a client directly. */
  async getDocumentUrl(requestId: string): Promise<string> {
    const request = await this.prisma.verificationRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException(`Verification request '${requestId}' not found`);
    }

    const { data, error } = await this.supabase.storage
      .from(SUPABASE_BUCKETS.VERIFICATION_DOCS)
      .createSignedUrl(request.documentKey, 300);
    if (error || !data) {
      throw new BadRequestException(`Failed to sign document URL: ${error?.message}`);
    }
    return data.signedUrl;
  }

  async review(
    requestId: string,
    adminId: string,
    dto: ReviewVerificationDto,
  ): Promise<VerificationRequestResponse> {
    const request = await this.prisma.verificationRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException(`Verification request '${requestId}' not found`);
    }
    if (
      request.status !== VerificationStatus.SUBMITTED &&
      request.status !== VerificationStatus.UNDER_REVIEW
    ) {
      throw new ConflictException(
        `Cannot review a request in status ${request.status}`,
      );
    }

    const newStatus = dto.approve ? VerificationStatus.VERIFIED : VerificationStatus.REJECTED;
    const now = new Date();

    const [updated] = await this.prisma.$transaction([
      this.prisma.verificationRequest.update({
        where: { id: requestId },
        data: {
          status: newStatus,
          reviewedBy: adminId,
          reviewNote: dto.note,
          reviewedAt: now,
        },
      }),
      this.prisma.user.update({
        where: { id: request.userId },
        data: { verificationStatus: newStatus },
      }),
      // On approval, the verified university becomes the mentor's affiliation
      // — this is what makes them discoverable under GET /mentors?universityId
      // and on the university detail screen's Mentors tab. The verification
      // request is the authoritative source for "which college", so this
      // always overwrites rather than only-if-unset.
      ...(dto.approve
        ? [
            this.prisma.userProfile.updateMany({
              where: { userId: request.userId },
              data: { universityId: request.universityId },
            }),
          ]
        : []),
    ]);

    await this.notificationsService.send({
      userId: request.userId,
      type: NotificationType.VERIFICATION,
      title: dto.approve ? 'You\'re verified!' : 'Verification declined',
      body: dto.approve
        ? 'Your student status is now verified.'
        : dto.note ?? 'Your submission could not be verified — you can resubmit.',
    });

    return toVerificationRequestResponse(updated);
  }
}
