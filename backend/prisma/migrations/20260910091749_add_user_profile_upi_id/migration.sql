-- MENTOR payout UPI ID (VPA), AES-256-GCM encrypted at rest. Additive,
-- nullable — existing rows are left NULL and requestPayout blocks a payout
-- request until the mentor sets one.
ALTER TABLE "user_profiles" ADD COLUMN "upi_id_encrypted" TEXT;
