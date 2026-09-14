import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import {
  toAdminAccountResponse,
  type AdminAccountResponse,
} from './admin-account-response.js';
import type { CreateAdminAccountDto } from './dto/create-admin-account.dto.js';
import type { UpdateAdminAccountDto } from './dto/update-admin-account.dto.js';

const BCRYPT_ROUNDS = 12;

/** A hash of a value nobody will ever type, used only so a lookup-by-email
 * that finds no row still spends roughly the same time on a bcrypt.compare
 * as one that does -- without this, "does this email exist" would leak
 * through response timing (a real bcrypt compare vs. an instant early
 * return) on top of the generic { ok: false } response already hiding it
 * from the response body itself. */
const DUMMY_HASH = bcrypt.hashSync(
  'no-such-admin-account-placeholder',
  BCRYPT_ROUNDS,
);

export interface AdminLoginResult {
  ok: boolean;
  email?: string;
  displayName?: string | null;
}

@Injectable()
export class AdminAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AdminAccountResponse[]> {
    const rows = await this.prisma.adminAccount.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toAdminAccountResponse);
  }

  async create(dto: CreateAdminAccountDto): Promise<AdminAccountResponse> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.adminAccount.findUnique({
      where: { email },
    });
    if (existing) {
      throw new ConflictException(
        'An admin account with that email already exists.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const row = await this.prisma.adminAccount.create({
      data: {
        email,
        passwordHash,
        displayName: dto.displayName?.trim() || null,
      },
    });
    return toAdminAccountResponse(row);
  }

  async update(
    id: string,
    dto: UpdateAdminAccountDto,
  ): Promise<AdminAccountResponse> {
    const existing = await this.prisma.adminAccount.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Admin account not found.');

    const row = await this.prisma.adminAccount.update({
      where: { id },
      data: {
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.displayName !== undefined
          ? { displayName: dto.displayName.trim() || null }
          : {}),
        ...(dto.password
          ? { passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS) }
          : {}),
      },
    });
    return toAdminAccountResponse(row);
  }

  /** Checks a login attempt against the DB-backed accounts only -- the
   * root ADMIN_EMAIL/ADMIN_PASSWORD env pair is checked entirely inside the
   * admin panel's own login route, before this is ever called (see
   * admin/app/api/auth/login/route.ts), so a backend outage or a bad DB
   * migration here can never lock the root credential out.
   *
   * Always does exactly one bcrypt.compare, real row or not, and always
   * returns the same shape -- no code path here should distinguish "no such
   * email" from "wrong password" in what it returns or how long it takes. */
  async verify(email: string, password: string): Promise<AdminLoginResult> {
    const normalized = email.trim().toLowerCase();
    const row = await this.prisma.adminAccount.findUnique({
      where: { email: normalized },
    });

    const hashToCheck = row?.passwordHash ?? DUMMY_HASH;
    const matches = await bcrypt.compare(password, hashToCheck);

    if (!row || !row.isActive || !matches) {
      return { ok: false };
    }

    await this.prisma.adminAccount.update({
      where: { id: row.id },
      data: { lastLoginAt: new Date() },
    });

    return { ok: true, email: row.email, displayName: row.displayName };
  }
}
