import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsEnum, IsString } from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { UsersService } from './users.service.js';

class StorePushTokenDto {
  @IsString()
  token!: string;

  @IsEnum(['ios', 'android'])
  platform!: 'ios' | 'android';
}

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@CurrentUser() user: JwtPayload) {
    return this.usersService.findById(user.sub);
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @Patch('me/role')
  @HttpCode(HttpStatus.OK)
  async updateRole(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.usersService.updateRole(user.sub, dto);
  }

  @Post('me/push-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  async storePushToken(
    @CurrentUser() user: JwtPayload,
    @Body() dto: StorePushTokenDto,
  ) {
    await this.usersService.storePushToken(user.sub, dto.token, dto.platform);
  }
}
