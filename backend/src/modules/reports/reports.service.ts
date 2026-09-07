import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  LedgerEntryType,
  NotificationType,
  ReportStatus,
  ReportTargetType,
} from '@prisma/client';
import { uniminutesLabel } from '../../common/helpers/notification-format.helper.js';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { WalletService } from '../wallet/wallet.service.js';
import { CreateReportDto } from './dto/create-report.dto.js';
import { ResolveReportDto } from './dto/resolve-report.dto.js';
import { ReportResponse, toReportResponse } from './report-response.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/**
 * ReportsService owns user-submitted reports (dropped calls, abusive
 * behaviour, off-platform payment requests, etc.) and their admin
 * resolution. Refunds are NEVER automatic — a mentor-side call drop still
 * bills the aspirant in full at the moment it happens (see
 * SessionsService); the only way money moves back is an admin reviewing
 * the report here and choosing to refund, which goes through
 * WalletService.applyLedgerEntry exactly like every other ledger write.
 */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(reporterId: string, dto: CreateReportDto): Promise<ReportResponse> {
    const report = await this.prisma.report.create({
      data: {
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
        description: dto.description,
      },
    });
    return toReportResponse(report);
  }

  async findAll(query: {
    status?: ReportStatus;
    cursor?: string;
    limit?: number;
  }): Promise<{ data: ReportResponse[]; nextCursor: string | null }> {
    const take = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    const rows = await this.prisma.report.findMany({
      where: query.status ? { status: query.status } : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: take + 1,
      include: { reporter: { select: { displayName: true } } },
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });

    const hasMore = rows.length > take;
    const rowsPage = hasMore ? rows.slice(0, take) : rows;
    const data = rowsPage.map(toReportResponse);
    const nextCursor = hasMore ? rowsPage[rowsPage.length - 1].id : null;

    return { data, nextCursor };
  }

  async findById(reportId: string): Promise<ReportResponse> {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) {
      throw new NotFoundException(`Report '${reportId}' not found`);
    }
    return toReportResponse(report);
  }

  /**
   * Admin resolution. If `refundAmountMinor` is set, the report must target
   * a SESSION — refunds the aspirant on that session's wallet with an
   * idempotency key derived from the report id, so resolving twice (e.g. a
   * double-click) can never double-refund.
   */
  async resolve(
    reportId: string,
    adminUserId: string,
    dto: ResolveReportDto,
  ): Promise<ReportResponse> {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) {
      throw new NotFoundException(`Report '${reportId}' not found`);
    }

    if (dto.refundAmountMinor) {
      if (report.targetType !== ReportTargetType.SESSION) {
        throw new BadRequestException('Refunds can only be issued against SESSION reports');
      }

      const session = await this.prisma.session.findUnique({
        where: { id: report.targetId },
      });
      if (!session) {
        throw new NotFoundException(`Session '${report.targetId}' not found`);
      }

      const aspirantWallet = await this.prisma.wallet.findUniqueOrThrow({
        where: { userId: session.aspirantId },
      });

      await this.walletService.applyLedgerEntry({
        walletId: aspirantWallet.id,
        type: LedgerEntryType.REFUND,
        amountMinor: dto.refundAmountMinor,
        idempotencyKey: `report-refund:${report.id}`,
        sessionId: session.id,
        note: `Admin refund for report ${report.id}${dto.resolution ? ` — ${dto.resolution}` : ''}`,
      });
    }

    const updated = await this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: dto.status,
        resolution: dto.resolution,
        actionedBy: adminUserId,
      },
    });

    // Close the loop with the person who filed it — otherwise a report just
    // silently disappears from their side, refund included.
    if (
      dto.status === ReportStatus.RESOLVED ||
      dto.status === ReportStatus.DISMISSED
    ) {
      const refundLine = dto.refundAmountMinor
        ? ` A refund of ${uniminutesLabel(dto.refundAmountMinor)} has been added to your wallet.`
        : '';
      await this.notifications
        .send({
          userId: report.reporterId,
          type: NotificationType.SYSTEM,
          title:
            dto.status === ReportStatus.RESOLVED
              ? 'Your report was reviewed'
              : 'Your report was closed',
          body: `We've finished reviewing the report you filed.${refundLine}`,
          metadata: {
            reportId: report.id,
            ...(report.targetType === ReportTargetType.SESSION
              ? { sessionId: report.targetId }
              : {}),
          },
        })
        .catch((err) =>
          this.logger.warn(`Report-resolution notification failed for ${report.id}: ${err}`),
        );
    }

    return toReportResponse(updated);
  }
}
