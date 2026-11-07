import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { CustomDegreeStatus, UserRole } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { CustomDegreesService } from './custom-degrees.service.js';
import { ReviewCustomDegreeDto } from './dto/review-custom-degree.dto.js';

/** ADMIN-only: approve / reject / rename the degrees users typed under
 * "Others". Surfaced in the admin panel's "Custom degrees" page. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/custom-degrees')
export class AdminCustomDegreesController {
  constructor(private readonly degrees: CustomDegreesService) {}

  @Get()
  list(
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedStatus =
      status === 'PENDING' || status === 'APPROVED' || status === 'REJECTED'
        ? (status as CustomDegreeStatus)
        : undefined;
    return this.degrees.findAllForAdmin({
      status: parsedStatus,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Patch(':id')
  review(
    @Param('id') id: string,
    @Body() dto: ReviewCustomDegreeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.degrees.review(id, user.sub, dto);
  }
}
