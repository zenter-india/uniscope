
-- CreateEnum
CREATE TYPE "MentorOnlineStatus" AS ENUM ('ONLINE', 'BUSY', 'OFFLINE');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('RECHARGE', 'SESSION_DEBIT', 'EARNING_CREDIT', 'COMMISSION', 'REFUND', 'BONUS', 'PAYOUT');

-- CreateEnum
CREATE TYPE "PaymentOrderStatus" AS ENUM ('CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('CHAT', 'CALL');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('REQUESTED', 'ACTIVE', 'PAUSED', 'ENDED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "SessionEndReason" AS ENUM ('NORMAL', 'LOW_BALANCE', 'MENTOR_LEFT', 'ASPIRANT_LEFT', 'TIMEOUT', 'SYSTEM');

-- AlterEnum
BEGIN;
CREATE TYPE "NotificationType_new" AS ENUM ('MESSAGE', 'REVIEW', 'VERIFICATION', 'SYSTEM', 'SESSION', 'WALLET', 'PAYMENT');
ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "public"."NotificationType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ReportTargetType_new" AS ENUM ('REVIEW', 'USER', 'SESSION');
ALTER TABLE "reports" ALTER COLUMN "target_type" TYPE "ReportTargetType_new" USING ("target_type"::text::"ReportTargetType_new");
ALTER TYPE "ReportTargetType" RENAME TO "ReportTargetType_old";
ALTER TYPE "ReportTargetType_new" RENAME TO "ReportTargetType";
DROP TYPE "public"."ReportTargetType_old";
COMMIT;

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'MENTOR';

-- DropForeignKey
ALTER TABLE "answer_votes" DROP CONSTRAINT "answer_votes_answer_id_fkey";

-- DropForeignKey
ALTER TABLE "answer_votes" DROP CONSTRAINT "answer_votes_user_id_fkey";

-- DropForeignKey
ALTER TABLE "answers" DROP CONSTRAINT "answers_author_id_fkey";

-- DropForeignKey
ALTER TABLE "answers" DROP CONSTRAINT "answers_question_id_fkey";

-- DropForeignKey
ALTER TABLE "chat_rooms" DROP CONSTRAINT "chat_rooms_initiator_id_fkey";

-- DropForeignKey
ALTER TABLE "chat_rooms" DROP CONSTRAINT "chat_rooms_mentor_id_fkey";

-- DropForeignKey
ALTER TABLE "chat_rooms" DROP CONSTRAINT "chat_rooms_university_id_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_room_id_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_sender_id_fkey";

-- DropForeignKey
ALTER TABLE "questions" DROP CONSTRAINT "questions_author_id_fkey";

-- DropForeignKey
ALTER TABLE "questions" DROP CONSTRAINT "questions_university_id_fkey";

-- DropForeignKey
ALTER TABLE "verification_requests" DROP CONSTRAINT "verification_requests_reviewed_by_fkey";

-- DropForeignKey
ALTER TABLE "verification_requests" DROP CONSTRAINT "verification_requests_university_id_fkey";

-- DropForeignKey
ALTER TABLE "verification_requests" DROP CONSTRAINT "verification_requests_user_id_fkey";

-- DropIndex
DROP INDEX "user_profiles_is_mentor_available_university_id_idx";

-- AlterTable
ALTER TABLE "user_profiles" DROP COLUMN "is_mentor_available";

-- DropTable
DROP TABLE "answer_votes";

-- DropTable
DROP TABLE "answers";

-- DropTable
DROP TABLE "chat_rooms";

-- DropTable
DROP TABLE "messages";

-- DropTable
DROP TABLE "questions";

-- DropTable
DROP TABLE "verification_requests";

-- DropEnum
DROP TYPE "ChatRoomStatus";

-- DropEnum
DROP TYPE "ChatRoomType";

-- DropEnum
DROP TYPE "MediaType";

-- DropEnum
DROP TYPE "MessageType";

-- DropEnum
DROP TYPE "QuestionStatus";

-- CreateTable
CREATE TABLE "mentor_verifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "university_id" TEXT NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "document_key" VARCHAR(500) NOT NULL,
    "enrollment_number" VARCHAR(100),
    "status" "VerificationStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewed_by" TEXT,
    "review_note" VARCHAR(500),
    "submitted_at" TIMESTAMPTZ,
    "reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "mentor_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "university_id" TEXT,
    "program_id" TEXT,
    "year_of_study" SMALLINT,
    "bio" VARCHAR(500),
    "expertise_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "chat_rate_per_min_minor" INTEGER NOT NULL DEFAULT 0,
    "call_rate_per_min_minor" INTEGER,
    "online_status" "MentorOnlineStatus" NOT NULL DEFAULT 'OFFLINE',
    "is_accepting_chats" BOOLEAN NOT NULL DEFAULT false,
    "free_first_minutes" INTEGER NOT NULL DEFAULT 0,
    "rating_avg" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "total_earnings_minor" INTEGER NOT NULL DEFAULT 0,
    "total_session_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "mentor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "balance_minor" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "balance_after_minor" INTEGER NOT NULL,
    "reference_type" VARCHAR(50),
    "reference_id" TEXT,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "description" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_orders" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "razorpay_order_id" VARCHAR(100) NOT NULL,
    "razorpay_payment_id" VARCHAR(100),
    "razorpay_signature" VARCHAR(255),
    "amount_minor" INTEGER NOT NULL,
    "bonus_minor" INTEGER NOT NULL DEFAULT 0,
    "status" "PaymentOrderStatus" NOT NULL DEFAULT 'CREATED',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "aspirant_id" TEXT NOT NULL,
    "mentor_id" TEXT NOT NULL,
    "type" "SessionType" NOT NULL DEFAULT 'CHAT',
    "status" "SessionStatus" NOT NULL DEFAULT 'REQUESTED',
    "rate_per_min_snapshot" INTEGER NOT NULL,
    "commission_rate" INTEGER NOT NULL,
    "free_seconds_applied" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ,
    "ended_at" TIMESTAMPTZ,
    "billed_seconds" INTEGER NOT NULL DEFAULT 0,
    "total_amount_minor" INTEGER NOT NULL DEFAULT 0,
    "commission_minor" INTEGER NOT NULL DEFAULT 0,
    "mentor_earning_minor" INTEGER NOT NULL DEFAULT 0,
    "external_channel_id" VARCHAR(255),
    "end_reason" "SessionEndReason",
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_ratings" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "rater_id" TEXT NOT NULL,
    "mentor_id" TEXT NOT NULL,
    "rating" SMALLINT NOT NULL,
    "comment" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "id" TEXT NOT NULL,
    "blocker_id" TEXT NOT NULL,
    "blocked_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mentor_verifications_user_id_idx" ON "mentor_verifications"("user_id");

-- CreateIndex
CREATE INDEX "mentor_verifications_status_submitted_at_idx" ON "mentor_verifications"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "mentor_verifications_reviewed_by_idx" ON "mentor_verifications"("reviewed_by");

-- CreateIndex
CREATE UNIQUE INDEX "mentor_profiles_user_id_key" ON "mentor_profiles"("user_id");

-- CreateIndex
CREATE INDEX "mentor_profiles_university_id_idx" ON "mentor_profiles"("university_id");

-- CreateIndex
CREATE INDEX "mentor_profiles_online_status_is_accepting_chats_idx" ON "mentor_profiles"("online_status", "is_accepting_chats");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entries_idempotency_key_key" ON "ledger_entries"("idempotency_key");

-- CreateIndex
CREATE INDEX "ledger_entries_wallet_id_created_at_idx" ON "ledger_entries"("wallet_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ledger_entries_reference_type_reference_id_idx" ON "ledger_entries"("reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_orders_razorpay_order_id_key" ON "payment_orders"("razorpay_order_id");

-- CreateIndex
CREATE INDEX "payment_orders_wallet_id_created_at_idx" ON "payment_orders"("wallet_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "payment_orders_status_idx" ON "payment_orders"("status");

-- CreateIndex
CREATE INDEX "sessions_aspirant_id_created_at_idx" ON "sessions"("aspirant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "sessions_mentor_id_created_at_idx" ON "sessions"("mentor_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "sessions_status_idx" ON "sessions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "session_ratings_session_id_key" ON "session_ratings"("session_id");

-- CreateIndex
CREATE INDEX "session_ratings_mentor_id_created_at_idx" ON "session_ratings"("mentor_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "blocks_blocked_id_idx" ON "blocks"("blocked_id");

-- CreateIndex
CREATE UNIQUE INDEX "blocks_blocker_id_blocked_id_key" ON "blocks"("blocker_id", "blocked_id");

-- AddForeignKey
ALTER TABLE "mentor_verifications" ADD CONSTRAINT "mentor_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_verifications" ADD CONSTRAINT "mentor_verifications_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_verifications" ADD CONSTRAINT "mentor_verifications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_profiles" ADD CONSTRAINT "mentor_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_profiles" ADD CONSTRAINT "mentor_profiles_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_profiles" ADD CONSTRAINT "mentor_profiles_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_aspirant_id_fkey" FOREIGN KEY ("aspirant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_ratings" ADD CONSTRAINT "session_ratings_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_ratings" ADD CONSTRAINT "session_ratings_rater_id_fkey" FOREIGN KEY ("rater_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_ratings" ADD CONSTRAINT "session_ratings_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

