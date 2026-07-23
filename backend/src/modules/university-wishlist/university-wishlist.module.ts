import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { UniversityReviewsModule } from '../university-reviews/university-reviews.module.js';
import { UniversityWishlistController } from './university-wishlist.controller.js';
import { UniversityWishlistService } from './university-wishlist.service.js';

@Module({
  imports: [PrismaModule, UniversityReviewsModule],
  controllers: [UniversityWishlistController],
  providers: [UniversityWishlistService],
})
export class UniversityWishlistModule {}
