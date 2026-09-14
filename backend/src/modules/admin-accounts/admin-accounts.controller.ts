import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { AdminAccountResponse } from './admin-account-response.js';
import {
  AdminAccountsService,
  type AdminLoginResult,
} from './admin-accounts.service.js';
import { CreateAdminAccountDto } from './dto/create-admin-account.dto.js';
import { UpdateAdminAccountDto } from './dto/update-admin-account.dto.js';
import { VerifyAdminAccountDto } from './dto/verify-admin-account.dto.js';

/** Manage who besides the root ADMIN_EMAIL/ADMIN_PASSWORD env pair can sign
 * into the admin panel -- reached from /dashboard/admins. ADMIN-only, same
 * as every other admin-management surface in this backend. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/admin-accounts')
export class AdminAccountsController {
  constructor(private readonly adminAccountsService: AdminAccountsService) {}

  @Get()
  list(): Promise<AdminAccountResponse[]> {
    return this.adminAccountsService.list();
  }

  @Post()
  create(@Body() dto: CreateAdminAccountDto): Promise<AdminAccountResponse> {
    return this.adminAccountsService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAdminAccountDto,
  ): Promise<AdminAccountResponse> {
    return this.adminAccountsService.update(id, dto);
  }
}

/**
 * Unauthenticated by necessity -- the admin panel's own login route calls
 * this to check a submitted email/password against the DB-backed accounts
 * *before* any session/JWT exists (the root env credential never reaches
 * here at all -- it's checked locally inside that same login route). This
 * is therefore a real credential-guessing surface on the backend itself,
 * same risk class as the panel's own login endpoint, so it's throttled the
 * same way this app's only other unauthenticated writes are (see
 * EnrollmentsController) rather than relying on the global 120/min default.
 */
@Controller('admin-accounts')
export class AdminAccountsAuthController {
  constructor(private readonly adminAccountsService: AdminAccountsService) {}

  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @Post('verify')
  verify(@Body() dto: VerifyAdminAccountDto): Promise<AdminLoginResult> {
    return this.adminAccountsService.verify(dto.email, dto.password);
  }
}
