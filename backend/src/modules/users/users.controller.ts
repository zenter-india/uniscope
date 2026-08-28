import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { AVATAR_OPTION_CATALOG } from '../avatar/avatar.constants.js';
import { AvatarService } from '../avatar/avatar.service.js';
import { StorePushTokenDto } from '../notifications/dto/list-notifications.dto.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ListUsersDto } from './dto/list-users.dto.js';
import { SetBannedDto } from './dto/set-banned.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { toPublicUser } from './user-response.js';
import { UsersService } from './users.service.js';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly avatarService: AvatarService,
  ) {}

  /** Live availability check for the mentor wizard's Alias field. */
  @Get('check-display-name')
  async checkDisplayName(
    @CurrentUser() user: JwtPayload,
    @Query('name') name: string,
  ) {
    const trimmed = (name ?? '').trim();
    if (trimmed.length < 2) {
      return { available: false };
    }
    return {
      available: await this.usersService.isDisplayNameAvailable(trimmed, user.sub),
    };
  }

  @Get('me')
  async getMe(@CurrentUser() user: JwtPayload) {
    // ensureUniqueId (not findById) so an existing user without one yet
    // gets backfilled the moment they load their own profile, as long as
    // profile.stream is already set.
    const found = await this.usersService.ensureUniqueId(user.sub);
    if (!found) {
      throw new NotFoundException('User not found');
    }
    return toPublicUser(found, this.usersService.avatarUrlFor(found));
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    const updated = await this.usersService.updateProfile(user.sub, dto);
    return toPublicUser(updated, this.usersService.avatarUrlFor(updated));
  }

  /** The catalogue the mobile customiser renders its pickers from —
   * served rather than hardcoded client-side so the two can't drift. */
  @Get('me/avatar/options')
  avatarOptions() {
    return AVATAR_OPTION_CATALOG;
  }

  @Get('me/avatar')
  async getAvatar(@CurrentUser() user: JwtPayload) {
    return this.usersService.getAvatarConfig(user.sub);
  }

  /** Renders the given config to SVG without touching storage or the DB —
   * lets the customiser show a live preview on every option tap instead of
   * only after Save. */
  @Post('me/avatar/preview')
  @HttpCode(HttpStatus.OK)
  async previewAvatar(@Body() body: unknown) {
    const config = this.avatarService.validateConfig(body);
    return { svg: await this.avatarService.renderSvg(config) };
  }

  /** Body is the raw config object; every field is validated against the
   * catalogue in AvatarService before anything is rendered or stored. */
  @Patch('me/avatar')
  @HttpCode(HttpStatus.OK)
  async updateAvatar(
    @CurrentUser() user: JwtPayload,
    @Body() body: unknown,
  ) {
    const config = await this.usersService.updateAvatar(user.sub, body);
    const found = await this.usersService.findById(user.sub);
    return {
      config,
      user: found ? toPublicUser(found, this.usersService.avatarUrlFor(found)) : null,
    };
  }

  @Patch('me/role')
  @HttpCode(HttpStatus.OK)
  async updateRole(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateRoleDto,
  ) {
    return toPublicUser(await this.usersService.updateRole(user.sub, dto));
  }

  /** Self-service account deletion — soft delete, see UsersService.deleteMe. */
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMe(@CurrentUser() user: JwtPayload) {
    await this.usersService.deleteMe(user.sub);
  }

  @Post('me/push-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  async storePushToken(
    @CurrentUser() user: JwtPayload,
    @Body() dto: StorePushTokenDto,
  ) {
    await this.notificationsService.registerPushToken(user.sub, dto.token, dto.platform);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  async findAll(@Query() query: ListUsersDto) {
    const { data, nextCursor } = await this.usersService.findAllAdmin(query);
    return { data: data.map((u) => toPublicUser(u)), nextCursor };
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/ban')
  @HttpCode(HttpStatus.OK)
  async setBanned(@Param('id') id: string, @Body() dto: SetBannedDto) {
    return toPublicUser(await this.usersService.setBanned(id, dto));
  }
}
