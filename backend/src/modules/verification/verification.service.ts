import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, Prisma, VerificationStatus } from '@prisma/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { SUPABASE_BUCKETS, SUPABASE_CLIENT } from '../../supabase/index.js';
import { ListVerificationHistoryDto } from './dto/list-verification-history.dto.js';
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

    await this.notificationsService
      .send({
        userId,
        type: NotificationType.VERIFICATION,
        title: 'Verification received',
        body: "We've got your documents — you'll be notified once an admin reviews them.",
      })
      .catch(() => {
        /* best-effort — the request is saved regardless */
      });

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
        user: {
          select: {
            displayName: true,
            role: true,
            profile: {
              select: {
                realNameEncrypted: true,
                gender: true,
                state: true,
                city: true,
                stream: true,
                qualification: true,
                specialization: true,
                courseInterested: true,
                yearOfStudy: true,
                graduationYear: true,
                yearInfoPrivate: true,
                dateOfBirth: true,
                languages: true,
                availableDays: true,
                goals: true,
                bio: true,
                specialty: true,
                preferredLanguage: true,
                preferredMentorshipTiming: true,
              },
            },
          },
        },
        university: { select: { name: true } },
      },
    });
    return rows.map(toVerificationRequestResponse);
  }

  /** ADMIN — resolved (VERIFIED/REJECTED) requests, newest-decision-first,
   * cursor-paginated. Distinct from findQueue: this is "what did we decide
   * and why", not "what's waiting" — so it carries the reviewer's note and
   * decision timestamp but not the full applicant snapshot (that's only
   * useful while a decision is still pending). */
  async findHistory(
    query: ListVerificationHistoryDto,
  ): Promise<{ data: VerificationRequestResponse[]; nextCursor: string | null }> {
    const take = Math.min(query.limit ?? 30, 50);
    const resolvedStatuses = [VerificationStatus.VERIFIED, VerificationStatus.REJECTED];

    const where: Prisma.VerificationRequestWhereInput = {
      status: query.status ?? { in: resolvedStatuses },
      ...(query.search && {
        user: { displayName: { contains: query.search, mode: 'insensitive' } },
      }),
    };

    const rows = await this.prisma.verificationRequest.findMany({
      where,
      orderBy: [{ reviewedAt: 'desc' }, { id: 'asc' }],
      take: take + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      include: {
        user: { select: { displayName: true, role: true } },
        university: { select: { name: true } },
      },
    });

    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    return {
      data: page.map(toVerificationRequestResponse),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
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
              data: {
                universityId: request.universityId,
                // From here on, a newly-verified mentor must review their
                // own college before they can switch on call bookings (see
                // UsersService.updateProfile). Existing verified mentors
                // were never flipped, so they stay exempt.
                mustReviewCollege: true,
              },
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

  /**
   * ADMIN bulk approve/reject — e.g. clearing a batch of straightforward
   * requests from the same college at once. Unlike the simple status-only
   * bulk updates elsewhere in the admin panel (leads, reviews), a single
   * review here has real side effects per request — a `$transaction`
   * touching `UserProfile` on approval, plus a notification send — so this
   * is deliberately a loop over the existing single-request `review()`
   * rather than a raw `updateMany`, which would silently skip all of that.
   * Each id is independent: one already-reviewed or missing request in the
   * batch doesn't fail the rest, and the caller gets back exactly which
   * ids succeeded vs. why one didn't, rather than a single opaque count.
   */
  async bulkReview(
    ids: string[],
    adminId: string,
    dto: ReviewVerificationDto,
  ): Promise<{ reviewed: number; failed: { id: string; reason: string }[] }> {
    let reviewed = 0;
    const failed: { id: string; reason: string }[] = [];
    for (const id of ids) {
      try {
        await this.review(id, adminId, dto);
        reviewed += 1;
      } catch (e) {
        failed.push({
          id,
          reason:
            e instanceof Error ? e.message : 'Could not review this request',
        });
      }
    }
    return { reviewed, failed };
  }
}
