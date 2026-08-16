import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './database/prisma/prisma.module.js';
import { HealthModule } from './health/health.module.js';

// Config
import {
  appConfig,
  databaseConfig,
  supabaseConfig,
  firebaseConfig,
  jwtConfig,
  redisConfig,
  twilioConfig,
  razorpayConfig,
  streamConfig,
  agoraConfig,
  validationSchema,
} from './config/index.js';

// Infrastructure
import { SupabaseModule } from './supabase/index.js';
import { FirebaseModule } from './firebase/index.js';
import { RedisModule } from './redis/index.js';

// Auth
import { AuthModule } from './auth/auth.module.js';

// Domain modules
import { AvatarModule } from './modules/avatar/avatar.module.js';
import { BlocksModule } from './modules/blocks/blocks.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { UniversitiesModule } from './modules/universities/universities.module.js';
import { MentorsModule } from './modules/mentors/mentors.module.js';
import { SessionsModule } from './modules/sessions/sessions.module.js';
import { WalletModule } from './modules/wallet/wallet.module.js';
import { VerificationModule } from './modules/verification/verification.module.js';
import { ReviewsModule } from './modules/reviews/reviews.module.js';
import { ChatModule } from './modules/chat/chat.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { AgoraModule } from './modules/agora/agora.module.js';
import { PayoutsModule } from './modules/payouts/payouts.module.js';
import { WishlistModule } from './modules/wishlist/wishlist.module.js';
import { UniversityReviewsModule } from './modules/university-reviews/university-reviews.module.js';
import { UniversityWishlistModule } from './modules/university-wishlist/university-wishlist.module.js';
import { DataImportModule } from './modules/data-import/data-import.module.js';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module.js';

@Module({
  imports: [
    // Global config — must come first so other modules can inject ConfigService
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        supabaseConfig,
        firebaseConfig,
        jwtConfig,
        redisConfig,
        twilioConfig,
        razorpayConfig,
        streamConfig,
        agoraConfig,
      ],
      validationSchema,
      validationOptions: { abortEarly: true },
    }),

    // Global rate limiting — per-IP default. Stricter, purpose-specific
    // limits (e.g. OTP send, 5/hr) already exist inside their own modules
    // via Redis and are unaffected by this; this is the general-abuse
    // backstop for every other endpoint (report creation, login-verify,
    // block/unblock, etc.) that previously had no throttling at all.
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),

    // Enables @Cron()/@Interval() decorators anywhere in the app — see
    // PayoutsService.remindEligibleMentors for the first user of it.
    ScheduleModule.forRoot(),

    // Core infrastructure
    PrismaModule,
    SupabaseModule,
    FirebaseModule,
    RedisModule,

    // Auth
    AuthModule,

    // Feature modules
    HealthModule,
    AvatarModule,
    BlocksModule,
    UsersModule,
    UniversitiesModule,
    MentorsModule,
    SessionsModule,
    WalletModule,
    VerificationModule,
    ReviewsModule,
    ChatModule,
    ReportsModule,
    NotificationsModule,
    AgoraModule,
    PayoutsModule,
    WishlistModule,
    UniversityReviewsModule,
    UniversityWishlistModule,
    DataImportModule,
    EnrollmentsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
