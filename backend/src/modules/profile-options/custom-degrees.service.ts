import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomDegree, CustomDegreeStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import type { ReviewCustomDegreeDto } from './dto/review-custom-degree.dto.js';
import type { SubmitCustomDegreeDto } from './dto/submit-custom-degree.dto.js';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

/** The picker's own catch-all chip — never a real degree name. */
const RESERVED_KEYS = new Set(['other', 'others']);

export interface CustomDegreeResponse {
  id: string;
  stream: string;
  name: string;
  status: CustomDegreeStatus;
  submissionCount: number;
  createdAt: Date;
  reviewedAt: Date | null;
}

function toResponse(row: CustomDegree): CustomDegreeResponse {
  return {
    id: row.id,
    stream: row.stream,
    name: row.name,
    status: row.status,
    submissionCount: row.submissionCount,
    createdAt: row.createdAt,
    reviewedAt: row.reviewedAt,
  };
}

/** Trim + collapse inner whitespace; the dedupe key is the lower-cased form. */
export function tidyDegreeName(raw: string): { name: string; nameKey: string } {
  const name = raw.trim().replace(/\s+/g, ' ');
  return { name, nameKey: name.toLowerCase() };
}

function isUsableName(name: string, nameKey: string): boolean {
  // Lower-casing can lengthen a few Unicode letters past the column width.
  return (
    name.length >= 2 && nameKey.length <= 50 && !RESERVED_KEYS.has(nameKey)
  );
}

/**
 * Degrees/courses people typed under "Others" in profile creation. They queue
 * as PENDING, an admin approves (optionally fixing the spelling), and APPROVED
 * ones are then offered as a normal option in that stream's degree picker.
 */
@Injectable()
export class CustomDegreesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Record a typed degree. Same (stream, name) again only bumps the count —
   * it never resurrects a REJECTED one or changes an APPROVED one. */
  async submit(
    userId: string,
    dto: SubmitCustomDegreeDto,
  ): Promise<{ status: CustomDegreeStatus }> {
    const { name, nameKey } = tidyDegreeName(dto.name);
    if (!isUsableName(name, nameKey)) {
      throw new BadRequestException('Enter the name of your degree or course.');
    }
    const row = await this.prisma.customDegree.upsert({
      where: { stream_nameKey: { stream: dto.stream, nameKey } },
      create: { stream: dto.stream, name, nameKey, firstSubmittedBy: userId },
      update: { submissionCount: { increment: 1 } },
    });
    return { status: row.status };
  }

  /** Names of the approved custom degrees for a stream, A–Z. */
  async listApprovedNames(stream: string): Promise<string[]> {
    const rows = await this.prisma.customDegree.findMany({
      where: { stream, status: CustomDegreeStatus.APPROVED },
      orderBy: { name: 'asc' },
      select: { name: true },
    });
    return rows.map((r) => r.name);
  }

  async findAllForAdmin(query: {
    status?: CustomDegreeStatus;
    cursor?: string;
    limit?: number;
  }): Promise<{ data: CustomDegreeResponse[]; nextCursor: string | null }> {
    const take = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const rows = await this.prisma.customDegree.findMany({
      where: query.status ? { status: query.status } : undefined,
      // Most-typed first, so the ones that matter most are at the top.
      orderBy: [
        { submissionCount: 'desc' },
        { createdAt: 'desc' },
        { id: 'asc' },
      ],
      take: take + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });
    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    return {
      data: page.map(toResponse),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async review(
    id: string,
    adminId: string,
    dto: ReviewCustomDegreeDto,
  ): Promise<CustomDegreeResponse> {
    const existing = await this.prisma.customDegree.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Custom degree not found');

    let name = existing.name;
    let nameKey = existing.nameKey;
    if (dto.name !== undefined) {
      const tidied = tidyDegreeName(dto.name);
      if (!isUsableName(tidied.name, tidied.nameKey)) {
        throw new BadRequestException('Enter a valid degree name.');
      }
      if (tidied.nameKey !== existing.nameKey) {
        const clash = await this.prisma.customDegree.findUnique({
          where: {
            stream_nameKey: {
              stream: existing.stream,
              nameKey: tidied.nameKey,
            },
          },
        });
        if (clash) {
          throw new ConflictException(
            `"${clash.name}" already exists for ${existing.stream} — reject this one instead.`,
          );
        }
      }
      name = tidied.name;
      nameKey = tidied.nameKey;
    }

    const pending = dto.status === 'PENDING';
    const row = await this.prisma.customDegree.update({
      where: { id },
      data: {
        name,
        nameKey,
        status: dto.status,
        reviewedBy: pending ? null : adminId,
        reviewedAt: pending ? null : new Date(),
      },
    });
    return toResponse(row);
  }
}
