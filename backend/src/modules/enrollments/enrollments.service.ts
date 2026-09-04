import { createHash, randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  EnrollmentLeadRole,
  EnrollmentLeadStatus,
  Prisma,
  UserRole,
  VerificationStatus,
} from '@prisma/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { SlackNotifierService } from '../../common/slack/slack-notifier.service.js';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { SUPABASE_BUCKETS, SUPABASE_CLIENT } from '../../supabase/index.js';
import { UsersService } from '../users/users.service.js';
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
  private readonly logger = new Logger(EnrollmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly slack: SlackNotifierService,
    private readonly usersService: UsersService,
  ) {}

  /** Same phoneHash derivation as AuthService.verifyOtp's production
   * (non-mock) path: sha256 of the whitespace-stripped phone string. Must
   * stay byte-for-byte identical to that method, or a website-provisioned
   * account will never be found by a later OTP login on the same number.
   * Safe here because `phone` is already this service's own E.164-
   * normalized value (see normalizePhone) — libphonenumber-js's E.164
   * output for a valid Indian number and the mobile client's own
   * `+91<digits>` string are the same shape, so the two sides hash
   * identically without needing to coordinate normalization logic. */
  private phoneHashFor(e164Phone: string): string {
    return createHash('sha256').update(e164Phone.replace(/\s+/g, '').trim()).digest('hex');
  }

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
   * Turns a lead submission into a real, immediately-usable account (per
   * explicit request): a website registration now provisions the actual
   * `User`/`UserProfile` row, pre-filled from what was submitted, so that
   * verifying OTP on the same phone in the app later logs straight into
   * this already-set-up account instead of a blank one that still needs
   * role selection or the onboarding wizard — findOrCreateByPhoneHash finds
   * it by the same phoneHash and returns isNewUser:false.
   *
   * Best-effort and non-fatal by design: this runs after the lead itself
   * is already safely upserted, wrapped in try/catch by both call sites,
   * so a bug or a transient DB/storage error here must never fail the
   * public form submission — worst case, the lead exists without a linked
   * account yet, exactly like before this feature existed.
   *
   * For a mentor with both a resolved universityId and an uploaded
   * document, also auto-submits their real VerificationRequest reusing the
   * already-uploaded file (same Supabase bucket, just a different key
   * prefix — see LEAD_DOCUMENT_PREFIX) rather than asking them to re-upload
   * inside the app, per explicit request. Skipped (left for the in-app
   * verification flow instead) when the college was only free-typed with
   * no matching University row, since VerificationRequest.universityId is
   * required.
   */
  private async provisionAccountFromLead(
    role: EnrollmentLeadRole,
    phone: string,
    dto: BaseLeadDto,
    profile: Prisma.UserProfileUncheckedCreateWithoutUserInput,
    mentorVerification?: {
      universityId: string | null;
      documentType?: Prisma.VerificationRequestUncheckedCreateInput['documentType'];
      documentKey: string | null;
    },
  ): Promise<void> {
    const phoneHash = this.phoneHashFor(phone);

    const { user, isNewUser } = await this.usersService.provisionAccountFromLead({
      phoneHash,
      role: role === EnrollmentLeadRole.MENTOR ? UserRole.MENTOR : UserRole.ASPIRANT,
      displayName: dto.alias,
      realName: dto.fullName,
      profile,
    });

    if (
      isNewUser &&
      role === EnrollmentLeadRole.MENTOR &&
      mentorVerification?.universityId &&
      mentorVerification.documentType &&
      mentorVerification.documentKey
    ) {
      await this.prisma.$transaction([
        this.prisma.verificationRequest.create({
          data: {
            userId: user.id,
            universityId: mentorVerification.universityId,
            documentType: mentorVerification.documentType,
            documentKey: mentorVerification.documentKey,
            status: VerificationStatus.SUBMITTED,
            submittedAt: new Date(),
          },
        }),
        this.prisma.user.update({
          where: { id: user.id },
          data: { verificationStatus: VerificationStatus.SUBMITTED },
        }),
      ]);
    }

    await this.prisma.enrollmentLead.update({
      where: { role_phone: { role, phone } },
      data: { convertedUserId: user.id, status: EnrollmentLeadStatus.CONVERTED },
    });
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

    // Checked ahead of the upsert (rather than inferred from the result)
    // because upsert's return value doesn't say which branch it took, and
    // the alert below should only fire for a genuinely new lead, not every
    // resubmission-as-correction this upsert also handles.
    const existed = await this.prisma.enrollmentLead.findUnique({
      where: { role_phone: { role, phone } },
      select: { id: true },
    });

    const lead = await this.prisma.enrollmentLead.upsert({
      where: { role_phone: { role, phone } },
      create: { role, phone, ...shared },
      update: shared,
    });

    if (!existed) {
      await this.slack.send(
        `:wave: New ${role.toLowerCase()} lead — ${shared.fullName} (${phone})`,
      );
    }

    return { id: lead.id, role: lead.role, status: lead.status };
  }

  /** Only accepts a universityId that actually resolves — a bad id from a
   * stale cached page would otherwise fail the FK and 500 the whole form.
   * The typed college name always survives regardless. */
  private async resolveUniversityId(
    universityId: string | undefined,
  ): Promise<string | null> {
    if (!universityId) return null;
    const university = await this.prisma.university.findUnique({
      where: { id: universityId },
      select: { id: true },
    });
    return university?.id ?? null;
  }

  async createAspirantLead(
    dto: CreateAspirantLeadDto,
  ): Promise<EnrollmentLeadAcknowledgement> {
    const universityId = await this.resolveUniversityId(dto.universityId);

    const ack = await this.upsertLead(EnrollmentLeadRole.ASPIRANT, dto, {
      alias: dto.alias,
      qualification: dto.qualification,
      universityId: universityId ?? undefined,
      collegeName: dto.collegeName,
      specialization: dto.specialization,
      courseInterested: dto.courseInterested,
      preferredLanguage: dto.preferredLanguage,
      preferredMentorshipTiming: dto.preferredMentorshipTiming,
    });

    try {
      await this.provisionAccountFromLead(EnrollmentLeadRole.ASPIRANT, this.normalizePhone(dto.phone), dto, {
        gender: dto.gender,
        state: dto.state,
        city: dto.city,
        stream: dto.stream,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        qualification: dto.qualification,
        specialization: dto.specialization,
        courseInterested: dto.courseInterested,
        preferredLanguage: dto.preferredLanguage,
        preferredMentorshipTiming: dto.preferredMentorshipTiming,
        universityId: universityId ?? undefined,
      });
    } catch (err) {
      // Never let account provisioning fail the public form submission --
      // the lead above is already safely saved either way.
      this.logger.error(
        `Failed to provision account for aspirant lead ${ack.id}`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    return ack;
  }

  /**
   * Mirrors CURATED_DEGREE_MAP_BY_STREAM in web/components/MentorForm.tsx
   * -- the form's raw degree label (what dto.degree actually carries,
   * e.g. "PG", "B.Tech/B.E", "UG") is NOT the same string as the
   * Program.name that degree's curated dataset was seeded under (e.g.
   * "MD/MS", "B.Tech", "Law-UG") -- only a few of the ten curated degrees
   * happen to coincide (DNB, Medical's "Diploma", MDS, DM/MCh). Needed
   * here so mapSpecializationToCollege looks up the *actual* Program row
   * instead of silently finding nothing for most streams. There is
   * nothing that enforces these two maps stay identical -- if
   * MentorForm.tsx's map changes, this one needs the same edit by hand.
   */
  /**
   * Mirrors SPECIALIZATION_SUGGESTION_STREAMS in
   * web/components/MentorForm.tsx -- must be kept in sync by hand, same
   * caveat as CURATED_PROGRAM_NAME_BY_STREAM_DEGREE below. Started
   * Medical-only (verified live end to end, including that Dental/
   * Engineering/Law stayed on the old "college's own list only"
   * behavior while this was Medical-scoped); now extended to every
   * stream with a curated per-college specialization dataset (see
   * scripts/data/README.md), per explicit request.
   */
  private static readonly SPECIALIZATION_SUGGESTION_STREAMS = new Set([
    'Medical',
    'Dental',
    'Engineering',
    'Law',
  ]);

  private static readonly CURATED_PROGRAM_NAME_BY_STREAM_DEGREE: Record<string, Record<string, string>> = {
    Medical: {
      DNB: 'DNB',
      PG: 'MD/MS',
      'MD/MS': 'MD/MS',
      Doctorate: 'MD/MS',
      Others: 'MD/MS',
      'DM/MCh': 'DM/MCh',
      Diploma: 'Diploma',
    },
    Dental: { MDS: 'MDS' },
    Engineering: {
      'B.Tech/B.E': 'B.Tech',
      'M.Tech/M.E': 'M.Tech',
      Diploma: 'Diploma-Engg',
    },
    Law: { UG: 'Law-UG', PG: 'Law-PG' },
  };

  /**
   * "Learn as you go" for the curated per-college specialization datasets
   * (see scripts/data/README.md) — they're necessarily incomplete, so a
   * mentor whose real specialization isn't yet mapped to their specific
   * college has to type it. If what they typed exactly matches (case-
   * insensitive) a specialization already known *somewhere* in this
   * stream+degree's overall dataset — a real, recognized value, not a
   * typo or something we've never seen — and the picked college's own
   * Program doesn't have it yet, add it there too (in its existing
   * canonical casing), so the next mentor who picks this same college
   * sees it directly instead of having to search the full list. An
   * unrecognized value is never added — it stays exactly what it was, a
   * plain string on this lead, with zero effect on the curated dataset.
   * Best-effort and silent: this is a side-effect of lead submission, not
   * the point of it, so any failure here must never fail the submission
   * itself. A no-op for any stream not in SPECIALIZATION_SUGGESTION_STREAMS
   * (Medical only, for now -- see that constant), and for any stream or
   * degree with no curated per-college dataset at all -- there's simply
   * nothing to map onto.
   */
  private async mapSpecializationToCollege(
    universityId: string,
    degree: string,
    stream: string,
    specialization: string,
  ): Promise<void> {
    if (!EnrollmentsService.SPECIALIZATION_SUGGESTION_STREAMS.has(stream)) return;
    try {
      const curatedName =
        EnrollmentsService.CURATED_PROGRAM_NAME_BY_STREAM_DEGREE[stream]?.[degree] ?? degree;
      const programName = curatedName.toUpperCase();
      const program = await this.prisma.program.findUnique({
        where: { universityId_name: { universityId, name: programName } },
      });
      if (!program) return;

      const alreadyMapped = program.specializations.some(
        (s) => s.toLowerCase() === specialization.toLowerCase(),
      );
      if (alreadyMapped) return;

      const siblingPrograms = await this.prisma.program.findMany({
        where: { name: programName, university: { stream } },
        select: { specializations: true },
      });
      const canonical = siblingPrograms
        .flatMap((p) => p.specializations)
        .find((s) => s.toLowerCase() === specialization.toLowerCase());
      if (!canonical) return; // not a recognized value -- leave the curated dataset alone

      await this.prisma.program.update({
        where: { id: program.id },
        data: { specializations: { push: canonical } },
      });
    } catch {
      // Best-effort only -- never let this break lead submission.
    }
  }

  async createMentorLead(
    dto: CreateMentorLeadDto,
  ): Promise<EnrollmentLeadAcknowledgement> {
    const universityId = await this.resolveUniversityId(dto.universityId);

    if (universityId && dto.degree && dto.stream && dto.specialization?.trim()) {
      await this.mapSpecializationToCollege(
        universityId,
        dto.degree,
        dto.stream,
        dto.specialization.trim(),
      );
    }

    const documentKey = dto.documentBase64
      ? await this.uploadDocument(dto.documentBase64)
      : null;

    const ack = await this.upsertLead(EnrollmentLeadRole.MENTOR, dto, {
      alias: dto.alias,
      universityId: universityId ?? undefined,
      collegeName: dto.collegeName,
      degree: dto.degree,
      specialization: dto.specialization,
      currentStatus: dto.currentStatus,
      yearOfStudy: dto.yearOfStudy,
      graduationYear: dto.graduationYear,
      yearInfoPrivate: dto.yearInfoPrivate,
      languages: dto.languages,
      availableDays: dto.availableDays,
      documentType: dto.documentType,
      // Undefined (not null) when no new file came in, so re-filling the form
      // without re-attaching keeps the document already on file.
      documentKey: documentKey ?? undefined,
    });

    try {
      await this.provisionAccountFromLead(
        EnrollmentLeadRole.MENTOR,
        this.normalizePhone(dto.phone),
        dto,
        {
          gender: dto.gender,
          state: dto.state,
          city: dto.city,
          stream: dto.stream,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          // Mentor's "degree" answer is the same UserProfile.qualification
          // column an aspirant's answer lands in (dual-purpose, mirroring
          // the mobile onboarding wizard's own mapping -- see
          // mentor_onboarding_screen.dart's `qualification: _degree`).
          qualification: dto.degree,
          specialization: dto.specialization,
          yearOfStudy: dto.yearOfStudy,
          graduationYear: dto.graduationYear,
          yearInfoPrivate: dto.yearInfoPrivate ?? false,
          languages: dto.languages ?? [],
          availableDays: dto.availableDays ?? [],
          universityId: universityId ?? undefined,
        },
        { universityId, documentType: dto.documentType, documentKey },
      );
    } catch (err) {
      this.logger.error(
        `Failed to provision account for mentor lead ${ack.id}`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    return ack;
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

  /**
   * A same summary every morning instead of someone having to open the
   * admin panel to notice new signups. Scoped to enrollment leads only for
   * now — pending verifications and open reports live in other modules and
   * are a natural next addition, not pulled in here yet to keep this
   * change self-contained to the enrollments domain.
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sendDailyDigest(): Promise<void> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [newLeads, newByRole] = await Promise.all([
      this.prisma.enrollmentLead.count({ where: { createdAt: { gt: since } } }),
      this.prisma.enrollmentLead.groupBy({
        by: ['role'],
        where: { createdAt: { gt: since } },
        _count: true,
      }),
    ]);

    if (newLeads === 0) return;

    const byRoleLine = newByRole.map((r) => `${r._count} ${r.role.toLowerCase()}`).join(', ');
    await this.slack.send(`:sunrise: ${newLeads} new enrollment lead(s) in the last 24h (${byRoleLine})`);
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

    const columns: [string, (l: EnrollmentLeadResponse) => string | number | null | undefined][] = [
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
      ['Alias', (l) => l.alias],
      ['College', (l) => l.universityName ?? l.collegeName],
      ['Degree', (l) => l.degree],
      ['Specialization', (l) => l.specialization],
      ['Current status', (l) => l.currentStatus],
      ['Year of study', (l) => l.yearOfStudy],
      ['Graduation year', (l) => l.graduationYear],
      ['Year info private', (l) => (l.yearInfoPrivate ? 'Yes' : 'No')],
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

    const escape = (value: string | number | null | undefined): string => {
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
