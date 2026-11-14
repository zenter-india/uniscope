import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  EnrollmentLeadRole,
  EnrollmentLeadStatus,
  UserRole,
} from '@prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { BulkUpdateLeadsDto } from './dto/bulk-update-leads.dto.js';
import {
  CreateAspirantLeadDto,
  CreateMentorLeadDto,
} from './dto/create-lead.dto.js';
import { AliasAvailableDto } from './dto/alias-available.dto.js';
import { ListLeadsDto } from './dto/list-leads.dto.js';
import { PhoneAvailableDto } from './dto/phone-available.dto.js';
import { UpdateLeadDto } from './dto/update-lead.dto.js';
import { EnrollmentLeadAcknowledgement } from './enrollment-lead-response.js';
import { EnrollmentsService } from './enrollments.service.js';

/**
 * Public pre-registration capture for the marketing website, plus the
 * ADMIN-only review/export surface.
 *
 * The two POST routes are the only unauthenticated *write* endpoints in the
 * app, so they carry their own throttle well below the global 120/min: a real
 * person fills these once, twice if they mistype something. Every read route
 * here is ADMIN-guarded, because a lead row contains a plaintext phone number.
 */
@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @Post('aspirant')
  createAspirant(
    @Body() dto: CreateAspirantLeadDto,
  ): Promise<EnrollmentLeadAcknowledgement> {
    if (dto.website)
      return Promise.resolve(this.silentlyAccept(EnrollmentLeadRole.ASPIRANT));
    return this.enrollmentsService.createAspirantLead(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @Post('mentor')
  createMentor(
    @Body() dto: CreateMentorLeadDto,
  ): Promise<EnrollmentLeadAcknowledgement> {
    if (dto.website)
      return Promise.resolve(this.silentlyAccept(EnrollmentLeadRole.MENTOR));
    return this.enrollmentsService.createMentorLead(dto);
  }

  /** Public: is this alias free? The website forms call it as the person types,
   * so they can be asked for another name before they go on. Answers only
   * yes/no (never who has it), and is throttled so it can't be used to list
   * names. Declared before the admin `:id` routes so "alias-available" is not
   * read as an id. */
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @Get('alias-available')
  aliasAvailable(@Query() query: AliasAvailableDto) {
    return this.enrollmentsService.isAliasAvailable(query.alias);
  }

  /** Public: is this phone number free to sign up with? A number can only be
   * used for one account, for either role. The forms ask before the person goes
   * on, so they are told early that the number already has an account. Answers only yes/no (never whose account or which
   * role) and is throttled tightly so it can't be used to test numbers in
   * bulk. A POST so the number stays out of URLs and logs. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('phone-available')
  @HttpCode(200)
  phoneAvailable(@Body() dto: PhoneAvailableDto) {
    return this.enrollmentsService.isPhoneAvailable(dto.phone);
  }

  /** Honeypot tripped — hand back a response indistinguishable from success so
   * the bot has nothing to learn from, while storing nothing. The id is random
   * and references no row. */
  private silentlyAccept(
    role: EnrollmentLeadRole,
  ): EnrollmentLeadAcknowledgement {
    return {
      id: crypto.randomUUID(),
      role,
      status: EnrollmentLeadStatus.NEW,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  list(@Query() query: ListLeadsDto) {
    return this.enrollmentsService.findAll(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('stats')
  stats() {
    return this.enrollmentsService.stats();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="uniscope-enrollments.csv"',
  )
  @Get('export')
  export(@Query() query: ListLeadsDto) {
    return this.enrollmentsService.exportCsv(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.enrollmentsService.findById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get(':id/document-url')
  async documentUrl(@Param('id') id: string) {
    return { url: await this.enrollmentsService.getDocumentUrl(id) };
  }

  // Declared before the single-lead `:id` route so `/enrollments/bulk`
  // doesn't get swallowed as `:id === 'bulk'`.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('bulk')
  bulkUpdate(@Body() dto: BulkUpdateLeadsDto) {
    return this.enrollmentsService.bulkUpdateStatus(dto.ids, dto.status);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.enrollmentsService.update(id, dto);
  }
}
