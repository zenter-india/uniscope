import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EnrollmentLeadRole, EnrollmentLeadStatus, Prisma } from '@prisma/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { SUPABASE_BUCKETS, SUPABASE_CLIENT } from '../../supabase/index.js';
import {
  BaseLeadDto,
  CreateAspirantLeadDto,
  CreateMentorLeadDto,
} from './dto/create-lead.dto.js';
import { ListLeadsDto } from './dto/list-leads.dto.js';
import { UpdateLeadDto } from './dto/update-lead.dto.js';
import {
  EnrollmentLeadAcknowledgement,
  EnrollmentLeadResponse,
  toEnrollmentLeadResponse,
} from './enrollment-lead-response.js';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

/** Uploaded college IDs live under their own prefix inside the existing
 * verification bucket, so a lead's document is never confused with a real
 * VerificationRequest's (which is keyed by `<userId>/`). */
const LEAD_DOCUMENT_PREFIX = 'enrollment-leads';

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /** E.164 so the (role, phone) uniqueness actually holds — otherwise the same
   * person typing "9876543210" and "+91 98765 43210" creates two leads. */
  private normalizePhone(raw: string): string {
    const parsed = parsePhoneNumberFromString(raw, 'IN');
    if (!parsed?.isValid()) {
      throw new BadRequestException('Enter a valid Indian mobile number');
    }
    return parsed.number;
  }

  private async uploadDocument(base64: string): Promise<string> {
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length === 0) {
      throw new BadRequestException('documentBase64 did not decode to any bytes');
    }

    const key = `${LEAD_DOCUMENT_PREFIX}/${randomUUID()}.jpg`;
    const { error } = await this.supabase.storage
      .from(SUPABASE_BUCKETS.VERIFICATION_DOCS)
      .upload(key, buffer, { contentType: 'image/jpeg', upsert: false });
    if (error) {
      throw new BadRequestException(`Failed to upload document: ${error.message}`);
    }
    return key;
  }

  /**
   * Shared write path for both public forms.
   *
   * Upserts on (role, phone) rather than erroring on a duplicate: someone who
   * fills the form twice — a common thing on marketing pages, e.g. after a
   * network blip — should end up with one corrected lead, not a hard failure
   * or a second row for sales to call twice. The CRM columns (status,
   * adminNote, convertedUserId) are deliberately excluded from the update, so
   * a resubmission can never reset a lead that has already been contacted or
   * converted back to NEW.
   */
  private async upsertLead(
    role: EnrollmentLeadRole,
    dto: BaseLeadDto,
    // Exactly the columns that are NOT shared or server-owned — so a field
    // handled by `shared` below can't be quietly passed in here twice, and a
    // caller can't reach the CRM columns through this path at all.
    roleSpecific: Partial<
      Omit<
        Prisma.EnrollmentLeadUncheckedCreateInput,
        | 'id'
        | 'role'
        | 'phone'
        | 'status'
        | 'convertedUserId'
        | 'adminNote'
        | 'createdAt'
        | 'updatedAt'
        | 'fullName'
        | 'email'
        | 'dateOfBirth'
        | 'gender'
        | 'state'
        | 'city'
        | 'stream'
      >
    >,
  ): Promise<EnrollmentLeadAcknowledgement> {
    const phone = this.normalizePhone(dto.phone);

    // Absent answers stay `undefined` rather than becoming `null`, which is
    // what makes the upsert below safe: Prisma reads undefined as "use the
    // column default" on create (null, or [] for the arrays) and as "leave
    // this column alone" on update. So someone who re-submits a shorter form
    // — a half-filled retry after a dropped connection, say — corrects what
    // they did fill in without erasing what they'd told us the first time.
    const shared = {
      fullName: dto.fullName.trim(),
      email: dto.email?.trim(),
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      gender: dto.gender,
      state: dto.state,
      city: dto.city,
      stream: dto.stream,
      ...roleSpecific,
    };

    const lead = await this.prisma.enrollmentLead.upsert({
      where: { role_phone: { role, phone } },
      create: { role, phone, ...shared },
      update: shared,
    });

    return { id: lead.id, role: lead.role, status: lead.status };
  }

  async createAspirantLead(
    dto: CreateAspirantLeadDto,
  ): Promise<EnrollmentLeadAcknowledgement> {
    return this.upsertLead(EnrollmentLeadRole.ASPIRANT, dto, {
      qualification: dto.qualification,
      courseInterested: dto.courseInterested,
      preferredLanguage: dto.preferredLanguage,
      preferredMentorshipTiming: dto.preferredMentorshipTiming,
      goals: dto.goals,
    });
  }

  async createMentorLead(
    dto: CreateMentorLeadDto,
  ): Promise<EnrollmentLeadAcknowledgement> {
    // Only accept a universityId that actually resolves — a bad id from a
    // stale cached page would otherwise fail the FK and 500 the whole form.
    // The typed college name always survives regardless.
    let universityId: string | null = null;
    if (dto.universityId) {
      const university = await this.prisma.university.findUnique({
        where: { id: dto.universityId },
        select: { id: true },
      });
      universityId = university?.id ?? null;
    }

    const documentKey = dto.documentBase64
      ? await this.uploadDocument(dto.documentBase64)
      : null;

    return this.upsertLead(EnrollmentLeadRole.MENTOR, dto, {
      alias: dto.alias,
      universityId: universityId ?? undefined,
      collegeName: dto.collegeName,
      degree: dto.degree,
      currentStatus: dto.currentStatus,
      yearOfStudy: dto.yearOfStudy,
      graduationYear: dto.graduationYear,
      languages: dto.languages,
      availableDays: dto.availableDays,
      documentType: dto.documentType,
      // Undefined (not null) when no new file came in, so re-filling the form
      // without re-attaching keeps the document already on file.
      documentKey: documentKey ?? undefined,
    });
  }

  /** ADMIN — cursor-paginated, newest first. */
  async findAll(
    query: ListLeadsDto,
  ): Promise<{ data: EnrollmentLeadResponse[]; nextCursor: string | null }> {
    const take = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    const where: Prisma.EnrollmentLeadWhereInput = {
      ...(query.role && { role: query.role }),
      ...(query.status && { status: query.status }),
      ...(query.search && {
        OR: [
          { fullName: { contains: query.search, mode: 'insensitive' } },
          { phone: { contains: query.search } },
          { email: { contains: query.search, mode: 'insensitive' } },
          { collegeName: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const rows = await this.prisma.enrollmentLead.findMany({
      where,
      include: { university: { select: { name: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: take + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });

    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;

    return {
      data: page.map(toEnrollmentLeadResponse),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  /** ADMIN — counts for the dashboard cards, one grouped query. */
  async stats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byRole: Record<string, number>;
  }> {
    const [byStatus, byRole, total] = await Promise.all([
      this.prisma.enrollmentLead.groupBy({ by: ['status'], _count: true }),
      this.prisma.enrollmentLead.groupBy({ by: ['role'], _count: true }),
      this.prisma.enrollmentLead.count(),
    ]);

    return {
      total,
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count])),
      byRole: Object.fromEntries(byRole.map((r) => [r.role, r._count])),
    };
  }

  async findById(id: string): Promise<EnrollmentLeadResponse> {
    const lead = await this.prisma.enrollmentLead.findUnique({
      where: { id },
      include: { university: { select: { name: true } } },
    });
    if (!lead) {
      throw new NotFoundException(`Enrollment lead '${id}' not found`);
    }
    return toEnrollmentLeadResponse(lead);
  }

  /** Short-lived signed URL for the uploaded college ID — the raw storage key
   * never leaves the server, same contract as VerificationService. */
  async getDocumentUrl(id: string): Promise<string> {
    const lead = await this.prisma.enrollmentLead.findUnique({ where: { id } });
    if (!lead) {
      throw new NotFoundException(`Enrollment lead '${id}' not found`);
    }
    if (!lead.documentKey) {
      throw new NotFoundException(`Enrollment lead '${id}' has no uploaded document`);
    }

    const { data, error } = await this.supabase.storage
      .from(SUPABASE_BUCKETS.VERIFICATION_DOCS)
      .createSignedUrl(lead.documentKey, 300);
    if (error || !data) {
      throw new BadRequestException(`Failed to sign document URL: ${error?.message}`);
    }
    return data.signedUrl;
  }

  async update(id: string, dto: UpdateLeadDto): Promise<EnrollmentLeadResponse> {
    const lead = await this.prisma.enrollmentLead.findUnique({ where: { id } });
    if (!lead) {
      throw new NotFoundException(`Enrollment lead '${id}' not found`);
    }

    if (dto.convertedUserId) {
      const user = await this.prisma.user.findUnique({
        where: { id: dto.convertedUserId },
        select: { id: true },
      });
      if (!user) {
        throw new BadRequestException(`User '${dto.convertedUserId}' not found`);
      }
    }

    const updated = await this.prisma.enrollmentLead.update({
      where: { id },
      data: {
        ...(dto.status && { status: dto.status }),
        ...(dto.adminNote !== undefined && { adminNote: dto.adminNote }),
        ...(dto.convertedUserId !== undefined && {
          convertedUserId: dto.convertedUserId,
          // Recording the linked account IS the conversion — keeping the two
          // in sync here means an admin can't leave a lead marked NEW while
          // its account already exists.
          status: EnrollmentLeadStatus.CONVERTED,
        }),
      },
      include: { university: { select: { name: true } } },
    });

    return toEnrollmentLeadResponse(updated);
  }

  /** ADMIN — CSV of every lead matching the filters, for offline follow-up.
   * Unpaginated by design: the point is to hand sales the whole list. */
  async exportCsv(query: ListLeadsDto): Promise<string> {
    const where: Prisma.EnrollmentLeadWhereInput = {
      ...(query.role && { role: query.role }),
      ...(query.status && { status: query.status }),
    };

    const rows = await this.prisma.enrollmentLead.findMany({
      where,
      include: { university: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const columns: [string, (l: EnrollmentLeadResponse) => unknown][] = [
      ['Submitted', (l) => l.createdAt.toISOString()],
      ['Role', (l) => l.role],
      ['Status', (l) => l.status],
      ['Name', (l) => l.fullName],
      ['Phone', (l) => l.phone],
      ['Email', (l) => l.email],
      ['Date of birth', (l) => l.dateOfBirth?.toISOString().slice(0, 10)],
      ['Gender', (l) => l.gender],
      ['State', (l) => l.state],
      ['City', (l) => l.city],
      ['Stream', (l) => l.stream],
      ['Qualification', (l) => l.qualification],
      ['Course interested', (l) => l.courseInterested],
      ['Preferred language', (l) => l.preferredLanguage],
      ['Preferred timing', (l) => l.preferredMentorshipTiming],
      ['Goals', (l) => l.goals.join('; ')],
      ['Alias', (l) => l.alias],
      ['College', (l) => l.universityName ?? l.collegeName],
      ['Degree', (l) => l.degree],
      ['Current status', (l) => l.currentStatus],
      ['Year of study', (l) => l.yearOfStudy],
      ['Graduation year', (l) => l.graduationYear],
      ['Languages', (l) => l.languages.join('; ')],
      ['Available days', (l) => l.availableDays.join('; ')],
      ['ID uploaded', (l) => (l.hasDocument ? 'Yes' : 'No')],
      ['Admin note', (l) => l.adminNote],
    ];

    // Excel reads a leading "=", "+", "-" or "@" as a formula, so a crafted
    // free-text answer could execute on whoever opens the export. Prefixing a
    // quote neutralises it while still displaying the original text.
    //
    // E.164 phone numbers are exempt: they also start with "+", they are the
    // column whoever opens this file actually needs to copy and dial, and they
    // cannot be hostile — the value is not user text but the output of
    // libphonenumber's normalisation (see normalizePhone), so it is always
    // "+" followed by digits and nothing else.
    const isNormalizedPhone = (str: string): boolean => /^\+\d{6,15}$/.test(str);

    const escape = (value: unknown): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      const safe =
        /^[=+\-@]/.test(str) && !isNormalizedPhone(str) ? `'${str}` : str;
      return `"${safe.replace(/"/g, '""')}"`;
    };

    const header = columns.map(([name]) => escape(name)).join(',');
    const body = rows
      .map(toEnrollmentLeadResponse)
      .map((lead) => columns.map(([, get]) => escape(get(lead))).join(','))
      .join('\n');

    return `${header}\n${body}`;
  }
}
