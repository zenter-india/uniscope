import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, University, UniversityType } from '@prisma/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { SUPABASE_BUCKETS, SUPABASE_CLIENT } from '../../supabase/index.js';
import { UniversityReviewsService } from '../university-reviews/university-reviews.service.js';
import { CreateUniversityDto } from './dto/create-university.dto.js';
import { FindOrCreateUniversityDto } from './dto/find-or-create-university.dto.js';
import { ListCuratedUniversitiesDto } from './dto/list-curated-universities.dto.js';
import { ListUniversitiesDto } from './dto/list-universities.dto.js';
import { UpdateUniversityDto } from './dto/update-university.dto.js';
import { UploadUniversityPhotoDto } from './dto/upload-university-photo.dto.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

// Number of colleges shown directly in the mentor form's curated
// College/University dropdown (highest specialization count first); every
// other seeded college is still reachable by typing it under "Other".
const CURATED_LIMIT = 30;

export interface CuratedCollegeOption {
  id: string;
  label: string;
  specializations: string[];
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class UniversitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly universityReviewsService: UniversityReviewsService,
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Cursor-paginated list of active universities, ordered by NIRF rank
   * (unranked last) with id as a stable tiebreaker for the cursor. This is
   * also the mentor form's UG/"Others" College field (CollegeSearch.tsx),
   * which needs `browse=true` (see below) — without it, the default
   * take-50-and-stop page only ever shows colleges from the very start of
   * the alphabet, since nothing narrows the query yet when the field is
   * first focused.
   *
   * Search is a case-insensitive *substring* match on `name` only (not
   * city/state — see the "b" search example below), but results are
   * ranked so a name *starting with* the query sorts before a name that
   * merely contains it elsewhere, each group alphabetical — plain
   * `contains` + alphabetical sort previously let irrelevant-looking
   * matches (e.g. a digit-prefixed name like "7 Air Force Hospital"
   * matching because names in general contain lots of common letters)
   * outrank the colleges someone was actually looking for. A college whose
   * city/state (not name) matches the query used to be included too,
   * which had its own confusing case: searching "b" could surface "Adesh
   * Institute…, Bhatinda" (name starts with A, city starts with B) ahead
   * of colleges actually named starting with B — dropped for that reason,
   * since this is a college *name* lookup.
   *
   * `browse=true` (CollegeSearch.tsx's only mode) returns every matching
   * row uncapped, ranked as above — same "browse the full list, not just
   * a capped page" contract as findCurated's browse mode, for the same
   * reason (a type-to-search field should let you actually reach every
   * college, not just the alphabetically-first handful). Without
   * `browse`, results stay cursor-paginated at `take` per page (the
   * Discover/Colleges tab's usage) — a plain `search` without `browse` in
   * that mode is still ranked but capped, e.g. mobile's small-page
   * typeahead.
   */
  async findAll(
    query: ListUniversitiesDto,
  ): Promise<{ data: University[]; nextCursor: string | null }> {
    const take = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const browse = query.browse === 'true';

    const where: Prisma.UniversityWhereInput = {
      isActive: true,
      ...(query.state && { state: query.state }),
      ...(query.type && { type: query.type }),
      ...(query.stream && { stream: query.stream }),
      ...(query.level && { levels: { has: query.level } }),
      ...(query.search && {
        name: { contains: query.search, mode: 'insensitive' },
      }),
    };

    if (browse || query.search) {
      const search = query.search?.toLowerCase();
      const rows = await this.prisma.university.findMany({ where });
      const sorted = rows.sort((a, b) => {
        if (search) {
          const aStarts = a.name.toLowerCase().startsWith(search) ? 0 : 1;
          const bStarts = b.name.toLowerCase().startsWith(search) ? 0 : 1;
          if (aStarts !== bStarts) return aStarts - bStarts;
        }
        return a.name.localeCompare(b.name);
      });
      return { data: browse ? sorted : sorted.slice(0, take), nextCursor: null };
    }

    const rows = await this.prisma.university.findMany({
      where,
      // Plain alphabetical — NIRF rank isn't shown in the UI anymore
      // (it only covers the top 50 medical colleges nationally, so ~94%
      // of rows had no rank anyway), id as a stable tiebreaker for the cursor.
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: take + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });

    const hasMore = rows.length > take;
    const data = hasMore ? rows.slice(0, take) : rows;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return { data, nextCursor };
  }

  /**
   * The mentor form's College/University list for a given stream+degree —
   * today Medical/DNB, Medical/MD-MS, Medical/DM-MCH, and Medical/DIPLOMA
   * have data (see scripts/seed-*-colleges.mjs). Two modes, though only
   * `browse=true` is used by any degree today (kept as the CURATED_LIMIT
   * default in case a future degree's data is too large to browse in full):
   *
   * - Default: top CURATED_LIMIT by number of accredited specializations,
   *   alphabetical. Every other seeded college for this stream+degree is
   *   still reachable in the DB but not surfaced here — the form falls
   *   back to a free-text "Other" entry.
   * - `browse=true` (MD/MS, DNB, Diploma, DM/MCh — all small/complete
   *   enough to browse in full): returns every matching college, uncapped,
   *   optionally filtered by `search` as a case-insensitive substring
   *   match on name — ranked the same way as findAll's search (see its
   *   doc comment): a name starting with the query sorts before a name
   *   that merely contains it elsewhere. The mentor form's College field
   *   is meant to list every college for these degrees, not a curated
   *   subset.
   *
   * Label is just "name, state" — no address/PIN, even for DNB/DM-MCh
   * colleges whose Program.description does carry a district (kept there
   * in case it's needed later, just not shown here).
   */
  async findCurated(
    query: ListCuratedUniversitiesDto,
  ): Promise<CuratedCollegeOption[]> {
    const browse = query.browse === 'true';

    const programs = await this.prisma.program.findMany({
      where: {
        name: query.degree.toUpperCase(),
        isActive: true,
        university: {
          stream: query.stream,
          isActive: true,
          ...(browse &&
            query.search && {
              name: { contains: query.search, mode: 'insensitive' },
            }),
        },
      },
      include: {
        university: { select: { id: true, name: true, state: true } },
      },
    });

    const options = programs
      .filter((program) => program.specializations.length > 0)
      .map((program) => ({
        specCount: program.specializations.length,
        id: program.universityId,
        label: `${program.university.name}, ${program.university.state}`,
        specializations: [...program.specializations].sort(),
      }));

    const search = browse && query.search ? query.search.toLowerCase() : null;
    const limited = browse
      ? options.sort((a, b) => {
          if (search) {
            const aStarts = a.label.toLowerCase().startsWith(search) ? 0 : 1;
            const bStarts = b.label.toLowerCase().startsWith(search) ? 0 : 1;
            if (aStarts !== bStarts) return aStarts - bStarts;
          }
          return a.label.localeCompare(b.label);
        })
      : options
          .sort((a, b) => b.specCount - a.specCount)
          .slice(0, CURATED_LIMIT)
          .sort((a, b) => a.label.localeCompare(b.label));

    return limited.map(({ id, label, specializations }) => ({
      id,
      label,
      specializations,
    }));
  }

  async findBySlug(slug: string) {
    const university = await this.prisma.university.findFirst({
      where: { slug, isActive: true },
      include: {
        programs: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!university) {
      throw new NotFoundException(`University '${slug}' not found`);
    }

    const rating = await this.universityReviewsService.ratingSummary(
      university.id,
    );
    return { ...university, rating: rating.average, reviewCount: rating.count };
  }

  /** Admin-only — includes inactive universities, unlike the public list. */
  async findAllAdmin(
    query: ListUniversitiesDto,
  ): Promise<{ data: University[]; nextCursor: string | null }> {
    const take = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    const where: Prisma.UniversityWhereInput = {
      ...(query.state && { state: query.state }),
      ...(query.type && { type: query.type }),
      ...(query.stream && { stream: query.stream }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { city: { contains: query.search, mode: 'insensitive' } },
          { state: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const rows = await this.prisma.university.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: take + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });

    const hasMore = rows.length > take;
    const data = hasMore ? rows.slice(0, take) : rows;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return { data, nextCursor };
  }

  /** Slug is derived once at creation and never changes afterward — stable
   * URLs matter more than keeping the slug in sync with a later name edit.
   * Collisions get a numeric suffix. */
  private async uniqueSlugFor(name: string): Promise<string> {
    const base = slugify(name) || 'university';
    let slug = base;
    let suffix = 1;
    while (await this.prisma.university.findUnique({ where: { slug } })) {
      suffix += 1;
      slug = `${base}-${suffix}`;
    }
    return slug;
  }

  async create(dto: CreateUniversityDto): Promise<University> {
    const slug = await this.uniqueSlugFor(dto.name);
    return this.prisma.university.create({ data: { ...dto, slug } });
  }

  /**
   * Used by the mentor onboarding wizard's College field for non-Medical
   * streams: rather than a curated dropdown (which today is really only
   * populated with medical institutions), a mentor types their college name
   * and this either matches an existing row (case-insensitive name+state)
   * or creates a new one. Verification (VerificationRequest.universityId)
   * requires a real university row, so this can't be a purely free-text
   * profile field — every mentor needs *some* University row to verify
   * against.
   *
   * New rows default to type PRIVATE (unknown at self-report time — an
   * admin can correct it later) and isActive: false, so a typo'd or
   * duplicate entry doesn't immediately pollute the public Discover
   * listing; it's still fully usable for this mentor's own verification
   * and shows up in the admin panel's university list for cleanup.
   */
  async findOrCreateByName(
    dto: FindOrCreateUniversityDto,
  ): Promise<University> {
    const name = dto.name.trim();
    const state = dto.state.trim();

    const existing = await this.prisma.university.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        state: { equals: state, mode: 'insensitive' },
      },
    });
    if (existing) return existing;

    const slug = await this.uniqueSlugFor(name);
    return this.prisma.university.create({
      data: {
        name,
        slug,
        type: UniversityType.PRIVATE,
        state,
        city: dto.city.trim(),
        stream: dto.stream,
        isActive: false,
      },
    });
  }

  async update(id: string, dto: UpdateUniversityDto): Promise<University> {
    const existing = await this.prisma.university.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`University '${id}' not found`);
    }
    return this.prisma.university.update({ where: { id }, data: dto });
  }

  /** Admin-only cover photo upload — unlike verification docs, this bucket is
   * public (the image is shown to every visitor of the college detail
   * screen), so we store the public URL directly rather than signing it
   * per-request. Bucket is created on first use since it isn't pre-provisioned. */
  async uploadPhoto(
    id: string,
    dto: UploadUniversityPhotoDto,
  ): Promise<University> {
    const existing = await this.prisma.university.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`University '${id}' not found`);
    }

    const buffer = Buffer.from(dto.imageBase64, 'base64');
    if (buffer.length === 0) {
      throw new BadRequestException('imageBase64 did not decode to any bytes');
    }

    const { error: createBucketError } =
      await this.supabase.storage.createBucket(
        SUPABASE_BUCKETS.UNIVERSITY_IMAGES,
        { public: true },
      );
    if (
      createBucketError &&
      !/already exists/i.test(createBucketError.message)
    ) {
      throw new BadRequestException(
        `Failed to prepare storage bucket: ${createBucketError.message}`,
      );
    }

    const imageKey = `${id}/${randomUUID()}.jpg`;
    const { error: uploadError } = await this.supabase.storage
      .from(SUPABASE_BUCKETS.UNIVERSITY_IMAGES)
      .upload(imageKey, buffer, { contentType: 'image/jpeg', upsert: true });
    if (uploadError) {
      throw new BadRequestException(
        `Failed to upload image: ${uploadError.message}`,
      );
    }

    const { data } = this.supabase.storage
      .from(SUPABASE_BUCKETS.UNIVERSITY_IMAGES)
      .getPublicUrl(imageKey);

    return this.prisma.university.update({
      where: { id },
      data: { imageUrl: data.publicUrl },
    });
  }
}
