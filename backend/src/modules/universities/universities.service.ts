import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, University } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { UniversityReviewsService } from '../university-reviews/university-reviews.service.js';
import { CreateUniversityDto } from './dto/create-university.dto.js';
import { ListUniversitiesDto } from './dto/list-universities.dto.js';
import { UpdateUniversityDto } from './dto/update-university.dto.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

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
  ) {}

  /**
   * Cursor-paginated list of active universities, ordered by NIRF rank
   * (unranked last) with id as a stable tiebreaker for the cursor.
   * Search is a simple case-insensitive match on name/city/state — full-text
   * via the search_vector column is a later enhancement.
   */
  async findAll(
    query: ListUniversitiesDto,
  ): Promise<{ data: University[]; nextCursor: string | null }> {
    const take = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    const where: Prisma.UniversityWhereInput = {
      isActive: true,
      ...(query.state && { state: query.state }),
      ...(query.type && { type: query.type }),
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
      orderBy: [{ nirfRank: 'asc' }, { id: 'asc' }],
      take: take + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });

    const hasMore = rows.length > take;
    const data = hasMore ? rows.slice(0, take) : rows;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return { data, nextCursor };
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

    const rating = await this.universityReviewsService.ratingSummary(university.id);
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
  async create(dto: CreateUniversityDto): Promise<University> {
    const base = slugify(dto.name) || 'university';
    let slug = base;
    let suffix = 1;
    while (await this.prisma.university.findUnique({ where: { slug } })) {
      suffix += 1;
      slug = `${base}-${suffix}`;
    }

    return this.prisma.university.create({ data: { ...dto, slug } });
  }

  async update(id: string, dto: UpdateUniversityDto): Promise<University> {
    const existing = await this.prisma.university.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`University '${id}' not found`);
    }
    return this.prisma.university.update({ where: { id }, data: dto });
  }
}
