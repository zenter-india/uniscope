-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReportReason" ADD VALUE 'ABUSIVE_LANGUAGE';
ALTER TYPE "ReportReason" ADD VALUE 'OFF_PLATFORM_PAYMENT_REQUEST';
ALTER TYPE "ReportReason" ADD VALUE 'CALL_DROPPED';

