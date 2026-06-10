import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
  validationSchema,
} from './config/index.js';

// Infrastructure
import { SupabaseModule } from './supabase/index.js';
import { FirebaseModule } from './firebase/index.js';
import { RedisModule } from './redis/index.js';

// Auth
import { AuthModule } from './auth/auth.module.js';

// Domain modules
import { UsersModule } from './modules/users/users.module.js';
import { UniversitiesModule } from './modules/universities/universities.module.js';
import { VerificationModule } from './modules/verification/verification.module.js';
import { QuestionsModule } from './modules/questions/questions.module.js';
import { ReviewsModule } from './modules/reviews/reviews.module.js';
import { ChatModule } from './modules/chat/chat.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';

@Module({
  imports: [
    // Global config — must come first so other modules can inject ConfigService
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, supabaseConfig, firebaseConfig, jwtConfig, redisConfig],
      validationSchema,
      validationOptions: { abortEarly: true },
    }),

    // Core infrastructure
    PrismaModule,
    SupabaseModule,
    FirebaseModule,
    RedisModule,

    // Auth
    AuthModule,

    // Feature modules
    HealthModule,
    UsersModule,
    UniversitiesModule,
    VerificationModule,
    QuestionsModule,
    ReviewsModule,
    ChatModule,
    ReportsModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
