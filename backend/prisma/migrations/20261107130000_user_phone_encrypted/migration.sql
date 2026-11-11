-- The user's mobile number, AES-256-GCM encrypted (PROFILE_ENCRYPTION_KEY), so an
-- admin can see it on the user's profile. Filled in at OTP login; existing rows
-- stay NULL until their user next logs in. The login identity is still the
-- one-way phone_hash.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "phone_encrypted" VARCHAR(255);
