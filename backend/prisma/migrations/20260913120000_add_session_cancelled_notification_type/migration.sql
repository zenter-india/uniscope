-- Additive enum value for the new "mentor can cancel an accepted booking,
-- and the other party now gets told" flow (SessionsService.cancel).
-- Postgres requires ADD VALUE to run alone, not alongside other DDL/DML
-- in the same statement -- this migration does nothing else.
ALTER TYPE "NotificationType" ADD VALUE 'SESSION_CANCELLED';
