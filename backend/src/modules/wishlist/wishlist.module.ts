import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { MentorsModule } from '../mentors/mentors.module.js';
import { WishlistController } from './wishlist.controller.js';
import { WishlistService } from './wishlist.service.js';

@Module({
  imports: [PrismaModule, MentorsModule],
  controllers: [WishlistController],
  providers: [WishlistService],
})
export class WishlistModule {}
