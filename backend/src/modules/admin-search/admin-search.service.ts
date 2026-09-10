import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';

export interface AdminSearchResult {
  users: {
    id: string;
    displayName: string;
    role: string;
    verificationStatus: string;
    isBanned: boolean;
  }[];
  universities: {
    id: string;
    name: string;
    slug: string;
    state: string;
    city: string | null;
    isActive: boolean;
  }[];
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Cross-entity quick lookup for the admin panel's header search box.
 * Matches users (display name, registry `uniqueId`, or raw UUID) and
 * universities (name or city). Deliberately small + capped — it's a
 * "jump to this record" affordance, not a report.
 */
@Injectable()
export class AdminSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(raw: string): Promise<AdminSearchResult> {
    const q = (raw ?? '').trim();
    if (q.length < 2) {
      return { users: [], universities: [] };
    }

    const [users, universities] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          role: { not: UserRole.ADMIN },
          OR: [
            { displayName: { contains: q, mode: 'insensitive' } },
            { uniqueId: { equals: q.toUpperCase() } },
            ...(UUID_RE.test(q) ? [{ id: q }] : []),
          ],
        },
        select: {
          id: true,
          displayName: true,
          role: true,
          verificationStatus: true,
          isBanned: true,
        },
        take: 8,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.university.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { city: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          slug: true,
          state: true,
          city: true,
          isActive: true,
        },
        take: 6,
        orderBy: { name: 'asc' },
      }),
    ]);

    return { users, universities };
  }
}
