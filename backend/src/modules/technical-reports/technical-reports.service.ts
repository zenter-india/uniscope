import { Injectable, NotFoundException } from '@nestjs/common';
import { TechnicalReportStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { CreateTechnicalReportDto } from './dto/create-technical-report.dto.js';
import { ResolveTechnicalReportDto } from './dto/resolve-technical-report.dto.js';
import {
  TechnicalReportResponse,
  toTechnicalReportResponse,
} from './technical-report-response.js';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

const REPORTER_SELECT = {
  user: { select: { displayName: true, uniqueId: true, role: true } },
} as const;

/**
 * Owns "Report a technical issue" submissions from the Help Centre. A flat
 * bug queue: any authenticated user can file one, an admin reads and
 * resolves it. No wallet involvement, no target — deliberately separate
 * from ReportsService (member/session moderation).
 */
@Injectable()
export class TechnicalReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    dto: CreateTechnicalReportDto,
  ): Promise<TechnicalReportResponse> {
    const row = await this.prisma.technicalReport.create({
      data: {
        userId,
        message: dto.message,
        platform: dto.platform,
        appVersion: dto.appVersion,
      },
    });
    return toTechnicalReportResponse(row);
  }

  async findAllForAdmin(query: {
    status?: TechnicalReportStatus;
    cursor?: string;
    limit?: number;
  }): Promise<{ data: TechnicalReportResponse[]; nextCursor: string | null }> {
    const take = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const rows = await this.prisma.technicalReport.findMany({
      where: query.status ? { status: query.status } : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: take + 1,
      include: REPORTER_SELECT,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });

    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    return {
      data: page.map((r) => toTechnicalReportResponse(r, true)),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async resolve(
    id: string,
    adminId: string,
    dto: ResolveTechnicalReportDto,
  ): Promise<TechnicalReportResponse> {
    const existing = await this.prisma.technicalReport.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Technical report not found');

    const resolving = dto.status === 'RESOLVED';
    const row = await this.prisma.technicalReport.update({
      where: { id },
      data: {
        status: dto.status as TechnicalReportStatus,
        adminNote: dto.adminNote ?? existing.adminNote,
        resolvedBy: resolving ? adminId : null,
        resolvedAt: resolving ? new Date() : null,
      },
      include: REPORTER_SELECT,
    });
    return toTechnicalReportResponse(row, true);
  }
}
